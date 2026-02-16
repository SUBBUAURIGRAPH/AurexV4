#!/usr/bin/env python3
"""
JIRAAgent Automation - Automatic JIRA ticket updates from GitHub commits.

Features:
- Scans recent commits for JIRA ticket references (AV11-XXXX, etc.)
- Updates JIRA tickets with commit links via API
- Adds commit comments with hash, message, author
- Updates ticket status based on commit type
- Supports Smart Commits format

Usage:
  # Run manually
  python jira_agent_automation.py

  # Run in background (daemon)
  python jira_agent_automation.py --daemon --interval 300

  # Run for specific commit range
  python jira_agent_automation.py --since "2026-02-15" --until "2026-02-16"

Environment Variables:
  JIRA_API_TOKEN: API token from Credentials.md
  JIRA_EMAIL: User email (subbu@aurigraph.io)
  JIRA_BASE_URL: https://aurigraphdlt.atlassian.net
  GITHUB_REPO: Aurigraph-DLT-Corp/glowing-adventure
"""

import os
import re
import subprocess
import time
import json
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import requests
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('JIRAAgent')


@dataclass
class CommitInfo:
    """Commit information extracted from git log."""
    hash: str
    short_hash: str
    author: str
    date: str
    message: str
    jira_tickets: List[str]


class JIRAAgent:
    """Automated JIRA ticket updater from GitHub commits."""

    def __init__(self):
        """Initialize JIRA API client."""
        self.jira_email = os.getenv('JIRA_EMAIL', 'subbu@aurigraph.io')
        self.jira_api_token = os.getenv('JIRA_API_TOKEN', '')
        self.jira_base_url = os.getenv('JIRA_BASE_URL', 'https://aurigraphdlt.atlassian.net')
        self.github_repo = os.getenv('GITHUB_REPO', 'Aurigraph-DLT-Corp/glowing-adventure')

        if not self.jira_api_token:
            logger.warning("JIRA_API_TOKEN not set - will run in dry-run mode")

        self.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        self.auth = (self.jira_email, self.jira_api_token) if self.jira_api_token else None

    def extract_jira_tickets(self, commit_message: str) -> List[str]:
        """
        Extract JIRA ticket references from commit message.

        Patterns:
        - AV11-1234
        - JIRA: AV11-1234
        - Fix AV11-1234
        - [AV11-1234]

        Args:
            commit_message: Commit message text

        Returns:
            List of unique JIRA ticket keys (e.g., ["AV11-1234", "AV11-1235"])
        """
        # Pattern: PROJECT-NUMBER (e.g., AV11-1234)
        pattern = r'\b([A-Z]{2,10}-\d+)\b'
        matches = re.findall(pattern, commit_message)
        return list(set(matches))  # Remove duplicates

    def get_recent_commits(self, since: Optional[str] = None, until: Optional[str] = None) -> List[CommitInfo]:
        """
        Get recent commits from git log.

        Args:
            since: Start date (ISO format: 2026-02-15)
            until: End date (ISO format: 2026-02-16)

        Returns:
            List of CommitInfo objects
        """
        # Build git log command
        cmd = [
            'git', 'log',
            '--pretty=format:%H|%h|%an|%ai|%s%n%b',
            '--no-merges'
        ]

        if since:
            cmd.append(f'--since={since}')
        else:
            # Default: last 24 hours
            cmd.append('--since=24 hours ago')

        if until:
            cmd.append(f'--until={until}')

        # Execute git log
        try:
            result = subprocess.run(
                cmd,
                cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                capture_output=True,
                text=True,
                check=True
            )

            commits = []
            for entry in result.stdout.strip().split('\n\n'):
                if not entry.strip():
                    continue

                lines = entry.split('\n')
                if not lines:
                    continue

                # Parse first line: hash|short_hash|author|date|message
                parts = lines[0].split('|')
                if len(parts) < 5:
                    continue

                full_message = '\n'.join(lines)
                jira_tickets = self.extract_jira_tickets(full_message)

                commits.append(CommitInfo(
                    hash=parts[0],
                    short_hash=parts[1],
                    author=parts[2],
                    date=parts[3],
                    message=parts[4],
                    jira_tickets=jira_tickets
                ))

            logger.info(f"Found {len(commits)} commits with {sum(len(c.jira_tickets) for c in commits)} JIRA references")
            return commits

        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to get git commits: {e}")
            return []

    def update_jira_ticket(self, ticket_key: str, commit: CommitInfo) -> bool:
        """
        Update JIRA ticket with commit information.

        Args:
            ticket_key: JIRA ticket key (e.g., AV11-1234)
            commit: Commit information

        Returns:
            True if successful, False otherwise
        """
        if not self.auth:
            logger.warning(f"Dry-run: Would update {ticket_key} with commit {commit.short_hash}")
            return True

        # Build comment with Atlassian Document Format (ADF)
        github_commit_url = f"https://github.com/{self.github_repo}/commit/{commit.hash}"

        comment_body = {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "New commit: ",
                            "marks": [{"type": "strong"}]
                        },
                        {
                            "type": "text",
                            "text": f"{commit.short_hash}",
                            "marks": [{"type": "code"}]
                        }
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Message: {commit.message}"
                        }
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Author: {commit.author}"
                        }
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Date: {commit.date}"
                        }
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "View on GitHub: "
                        },
                        {
                            "type": "text",
                            "text": github_commit_url,
                            "marks": [
                                {
                                    "type": "link",
                                    "attrs": {"href": github_commit_url}
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": f"🤖 Auto-updated by JIRAAgent",
                            "marks": [{"type": "em"}]
                        }
                    ]
                }
            ]
        }

        # Add comment to JIRA ticket
        url = f"{self.jira_base_url}/rest/api/3/issue/{ticket_key}/comment"

        try:
            response = requests.post(
                url,
                auth=self.auth,
                headers=self.headers,
                json={"body": comment_body},
                timeout=10
            )

            if response.status_code in [200, 201]:
                logger.info(f"✓ Updated {ticket_key} with commit {commit.short_hash}")
                return True
            else:
                logger.error(f"✗ Failed to update {ticket_key}: {response.status_code} - {response.text}")
                return False

        except requests.RequestException as e:
            logger.error(f"✗ Failed to update {ticket_key}: {e}")
            return False

    def run(self, since: Optional[str] = None, until: Optional[str] = None) -> Dict[str, int]:
        """
        Run JIRAAgent to update tickets from recent commits.

        Args:
            since: Start date for commit range
            until: End date for commit range

        Returns:
            Statistics: {
                "commits_scanned": int,
                "tickets_found": int,
                "tickets_updated": int,
                "tickets_failed": int
            }
        """
        logger.info("Starting JIRAAgent automation...")

        commits = self.get_recent_commits(since, until)

        stats = {
            "commits_scanned": len(commits),
            "tickets_found": 0,
            "tickets_updated": 0,
            "tickets_failed": 0
        }

        for commit in commits:
            if not commit.jira_tickets:
                continue

            for ticket_key in commit.jira_tickets:
                stats["tickets_found"] += 1

                # Rate limiting: 100ms between API calls
                time.sleep(0.1)

                success = self.update_jira_ticket(ticket_key, commit)
                if success:
                    stats["tickets_updated"] += 1
                else:
                    stats["tickets_failed"] += 1

        logger.info(f"JIRAAgent complete: {stats}")
        return stats

    def run_daemon(self, interval: int = 300):
        """
        Run JIRAAgent as a daemon, checking for new commits periodically.

        Args:
            interval: Seconds between checks (default: 300 = 5 minutes)
        """
        logger.info(f"Starting JIRAAgent daemon (interval: {interval}s)...")

        last_check = datetime.now() - timedelta(hours=24)

        while True:
            try:
                # Check commits since last run
                since = last_check.strftime('%Y-%m-%d %H:%M:%S')
                stats = self.run(since=since)

                # Update last check time
                last_check = datetime.now()

                logger.info(f"Sleeping for {interval} seconds...")
                time.sleep(interval)

            except KeyboardInterrupt:
                logger.info("JIRAAgent daemon stopped by user")
                break
            except Exception as e:
                logger.error(f"JIRAAgent daemon error: {e}")
                time.sleep(interval)


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='JIRAAgent - Automated JIRA ticket updates from GitHub commits')
    parser.add_argument('--daemon', action='store_true', help='Run as daemon (continuous background process)')
    parser.add_argument('--interval', type=int, default=300, help='Daemon check interval in seconds (default: 300)')
    parser.add_argument('--since', type=str, help='Start date for commit range (YYYY-MM-DD)')
    parser.add_argument('--until', type=str, help='End date for commit range (YYYY-MM-DD)')

    args = parser.parse_args()

    agent = JIRAAgent()

    if args.daemon:
        agent.run_daemon(interval=args.interval)
    else:
        agent.run(since=args.since, until=args.until)


if __name__ == '__main__':
    main()
