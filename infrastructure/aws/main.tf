# Aurigraph v2.1.0 - AWS Infrastructure as Code (Terraform)
# Complete production deployment infrastructure on AWS

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "aurigraph-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Aurigraph"
      Environment = var.environment
      Version     = "2.1.0"
      ManagedBy   = "Terraform"
    }
  }
}

# VPC
resource "aws_vpc" "aurigraph" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "aurigraph-vpc-${var.environment}"
  }
}

# Subnets
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.aurigraph.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "aurigraph-public-subnet-${count.index + 1}"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.aurigraph.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "aurigraph-private-subnet-${count.index + 1}"
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Internet Gateway
resource "aws_internet_gateway" "aurigraph" {
  vpc_id = aws_vpc.aurigraph.id

  tags = {
    Name = "aurigraph-igw"
  }
}

# Elastic IPs for NAT
resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"

  depends_on = [aws_internet_gateway.aurigraph]

  tags = {
    Name = "aurigraph-eip-${count.index + 1}"
  }
}

# NAT Gateways
resource "aws_nat_gateway" "aurigraph" {
  count         = 2
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.aurigraph]

  tags = {
    Name = "aurigraph-nat-${count.index + 1}"
  }
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.aurigraph.id

  route {
    cidr_block      = "0.0.0.0/0"
    gateway_id      = aws_internet_gateway.aurigraph.id
  }

  tags = {
    Name = "aurigraph-public-rt"
  }
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.aurigraph.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.aurigraph[count.index].id
  }

  tags = {
    Name = "aurigraph-private-rt-${count.index + 1}"
  }
}

# Route table associations
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# Security Groups
resource "aws_security_group" "alb" {
  name        = "aurigraph-alb-sg"
  description = "Security group for ALB"
  vpc_id      = aws_vpc.aurigraph.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "aurigraph-alb-sg"
  }
}

resource "aws_security_group" "ecs" {
  name        = "aurigraph-ecs-sg"
  description = "Security group for ECS tasks"
  vpc_id      = aws_vpc.aurigraph.id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "aurigraph-ecs-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "aurigraph-rds-sg"
  description = "Security group for RDS"
  vpc_id      = aws_vpc.aurigraph.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "aurigraph-rds-sg"
  }
}

resource "aws_security_group" "elasticache" {
  name        = "aurigraph-elasticache-sg"
  description = "Security group for ElastiCache"
  vpc_id      = aws_vpc.aurigraph.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "aurigraph-elasticache-sg"
  }
}

# RDS PostgreSQL Database
resource "aws_db_subnet_group" "aurigraph" {
  name       = "aurigraph-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "aurigraph-db-subnet-group"
  }
}

resource "aws_db_instance" "aurigraph" {
  identifier              = "aurigraph-${var.environment}"
  allocated_storage       = var.db_allocated_storage
  storage_type            = "gp3"
  engine                  = "postgres"
  engine_version          = "14.7"
  instance_class          = var.db_instance_class
  username                = var.db_username
  password                = var.db_password
  db_name                 = var.db_name
  db_subnet_group_name    = aws_db_subnet_group.aurigraph.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false
  skip_final_snapshot     = var.environment == "staging" ? true : false
  final_snapshot_identifier = var.environment == "staging" ? null : "aurigraph-${var.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  backup_retention_period = var.environment == "production" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "mon:04:00-mon:05:00"
  multi_az                = var.environment == "production" ? true : false
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds.arn
  enabled_cloudwatch_logs_exports = ["postgresql"]
  deletion_protection     = var.environment == "production" ? true : false

  tags = {
    Name = "aurigraph-db-${var.environment}"
  }
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true
}

resource "aws_kms_alias" "rds" {
  name          = "alias/aurigraph-rds-${var.environment}"
  target_key_id = aws_kms_key.rds.key_id
}

# ElastiCache Redis
resource "aws_elasticache_subnet_group" "aurigraph" {
  name       = "aurigraph-cache-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "aurigraph" {
  replication_group_description = "Aurigraph Redis cluster"
  engine                        = "redis"
  engine_version                = "7.0"
  node_type                     = var.cache_node_type
  num_cache_clusters            = var.environment == "production" ? 2 : 1
  parameter_group_name          = "default.redis7"
  port                          = 6379
  subnet_group_name             = aws_elasticache_subnet_group.aurigraph.name
  security_group_ids            = [aws_security_group.elasticache.id]
  automatic_failover_enabled    = var.environment == "production" ? true : false
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  auth_token                    = var.redis_auth_token
  multi_az_enabled              = var.environment == "production" ? true : false
  snapshot_retention_limit      = var.environment == "production" ? 30 : 5
  snapshot_window               = "03:00-05:00"
  maintenance_window            = "mon:04:00-mon:06:00"
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  tags = {
    Name = "aurigraph-redis-${var.environment}"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/aurigraph-${var.environment}"
  retention_in_days = var.environment == "production" ? 30 : 7

  tags = {
    Name = "aurigraph-ecs-logs"
  }
}

resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/aurigraph-redis-slow-log"
  retention_in_days = 7

  tags = {
    Name = "aurigraph-redis-slow-log"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "aurigraph" {
  name = "aurigraph-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "aurigraph-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "aurigraph" {
  cluster_name = aws_ecs_cluster.aurigraph.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = "FARGATE"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "aurigraph" {
  family                   = "aurigraph-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "2048"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "aurigraph"
      image     = "${var.ecr_repository_url}:v2.1.0-prod"
      essential = true

      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "DB_HOST", value = aws_db_instance.aurigraph.endpoint },
        { name = "DB_PORT", value = "5432" },
        { name = "DB_NAME", value = var.db_name },
        { name = "REDIS_HOST", value = aws_elasticache_replication_group.aurigraph.primary_endpoint_address },
        { name = "REDIS_PORT", value = "6379" },
        { name = "LOG_LEVEL", value = "info" }
      ]

      secrets = [
        { name = "DB_USER", valueFrom = "${aws_secretsmanager_secret.db_user.arn}" },
        { name = "DB_PASSWORD", valueFrom = "${aws_secretsmanager_secret.db_password.arn}" },
        { name = "REDIS_PASSWORD", valueFrom = "${aws_secretsmanager_secret.redis_password.arn}" }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "aurigraph-task-def"
  }
}

# ECS Service
resource "aws_ecs_service" "aurigraph" {
  name            = "aurigraph-${var.environment}"
  cluster         = aws_ecs_cluster.aurigraph.id
  task_definition = aws_ecs_task_definition.aurigraph.arn
  desired_count   = var.ecs_desired_count
  launch_type     = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.aurigraph.arn
    container_name   = "aurigraph"
    container_port   = 8080
  }

  depends_on = [
    aws_lb_listener.http,
    aws_db_instance.aurigraph,
    aws_elasticache_replication_group.aurigraph
  ]

  tags = {
    Name = "aurigraph-service"
  }
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.ecs_max_capacity
  min_capacity       = var.ecs_min_capacity
  resource_id        = "service/${aws_ecs_cluster.aurigraph.name}/${aws_ecs_service.aurigraph.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_policy_cpu" {
  name               = "aurigraph-cpu-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}

resource "aws_appautoscaling_policy" "ecs_policy_memory" {
  name               = "aurigraph-memory-autoscaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0
  }
}

# Application Load Balancer
resource "aws_lb" "aurigraph" {
  name               = "aurigraph-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production" ? true : false

  tags = {
    Name = "aurigraph-alb"
  }
}

resource "aws_lb_target_group" "aurigraph" {
  name        = "aurigraph-tg-${var.environment}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.aurigraph.id
  target_type = "ip"

  health_check {
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }

  tags = {
    Name = "aurigraph-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.aurigraph.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.aurigraph.arn
  }
}

# IAM Roles for ECS
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "aurigraph-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "aurigraph-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# Secrets Manager
resource "aws_secretsmanager_secret" "db_user" {
  name                    = "aurigraph/db/username"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_user" {
  secret_id       = aws_secretsmanager_secret.db_user.id
  secret_string   = var.db_username
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "aurigraph/db/password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id       = aws_secretsmanager_secret.db_password.id
  secret_string   = var.db_password
}

resource "aws_secretsmanager_secret" "redis_password" {
  name                    = "aurigraph/redis/password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "redis_password" {
  secret_id       = aws_secretsmanager_secret.redis_password.id
  secret_string   = var.redis_auth_token
}

# Outputs
output "alb_dns_name" {
  description = "DNS name of load balancer"
  value       = aws_lb.aurigraph.dns_name
}

output "rds_endpoint" {
  description = "RDS database endpoint"
  value       = aws_db_instance.aurigraph.endpoint
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.aurigraph.primary_endpoint_address
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.aurigraph.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.aurigraph.name
}
