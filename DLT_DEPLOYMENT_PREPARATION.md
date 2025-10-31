# DLT Deployment - Preparation & Credential Collection Guide

**Date**: October 31, 2025
**Status**: 🔄 Awaiting Aurigraph API Credentials
**Remote Server**: hms.aurex.in
**Deployment Path**: /opt/HMS

---

## 🔑 Step 1: Obtain Aurigraph API Credentials

### Prerequisites
- [ ] Aurigraph account with admin/developer access
- [ ] Internet connection to https://dashboard.aurigraph.io
- [ ] Secure location to temporarily store credentials (password manager recommended)

### How to Generate API Credentials

**1. Login to Aurigraph Dashboard**
```
URL: https://dashboard.aurigraph.io
Username: Your Aurigraph account email
Password: Your Aurigraph password
```

**2. Navigate to API Keys Section**
```
Dashboard Menu → Settings → API Keys
```

**3. Generate New Key**
```
Click "Generate New API Key" button
```

**4. Configure Key Settings**
```
Environment: Production
Key Name: HMS_DLT_PRODUCTION (recommended)
Permissions: Full Access (required for DLT configuration)
```

**5. Copy Your Credentials**
After generation, you'll see:
```
API KEY: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
API SECRET: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

⚠️ **IMPORTANT**:
- The SECRET appears only ONCE
- Copy both values immediately
- Store securely (don't share or commit to git)
- Never paste in chat/email/unsecured systems

---

## 📋 Credential Template

Create a temporary file with your credentials (DO NOT commit this to git):

```
DLT_API_KEY=<paste-your-api-key-here>
DLT_API_SECRET=<paste-your-api-secret-here>
DLT_API_BASE_URL=https://api.aurigraph.io
DLT_ENVIRONMENT=production
```

**Storage Options** (Most to Least Secure):
1. ✅ **BEST**: Use a secure password manager, pass on demand
2. ✅ **GOOD**: Store in `.env.dlt.local` (not committed)
3. ⚠️ **AVOID**: Plain text files
4. ❌ **DO NOT**: Email, Slack, Github

---

## 🚀 Ready to Deploy?

Once you have your credentials, respond with:

```
I'm ready to deploy with DLT configuration
```

Then provide:
- API Key
- API Secret

**What happens next:**
1. Script will create `.env.dlt` file with credentials
2. DLT services will be configured on production server
3. Services will be restarted and verified
4. Health check will confirm successful deployment

---

## ⏱️ Timeline

- **Step 1** (Dashboard access): 2-5 minutes
- **Step 2** (Key generation): 1-2 minutes
- **Step 3** (Credential collection): 1 minute
- **Ready for deployment**: After you provide credentials

**Total time for full deployment**: ~60 minutes (once credentials obtained)

---

## 📞 Support

**If you can't find API Keys section:**
- Check if your Aurigraph account has admin access
- Contact Aurigraph support: support@aurigraph.io
- Or contact your Aurigraph account manager

**If credentials were lost:**
- Regenerate new credentials from same page
- Previous credentials will be revoked automatically

---

## 🔒 Security Checklist

- [ ] Credentials obtained from official Aurigraph dashboard
- [ ] API Key and Secret copied accurately
- [ ] No credentials will be stored in git
- [ ] No credentials will be logged or shared
- [ ] Encrypted transmission to production server
- [ ] Secure .env.dlt file with limited permissions

---

## ✨ Next Steps

When ready with credentials:

**Send message**: "Ready for DLT deployment - here are my credentials"

Then I will:
1. ✅ Deploy scripts to remote server
2. ✅ Configure DLT services
3. ✅ Verify service health
4. ✅ Generate deployment report
5. ✅ Confirm production readiness

---

**Status**: Awaiting credentials from Aurigraph dashboard
**Deployment Status**: PAUSED - Ready to proceed on credential availability

---

*Your HMS platform is ready for DLT configuration. Just need your Aurigraph credentials to complete the deployment.*
