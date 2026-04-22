terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Values provided via -backend-config flags in CI or via ~/.terraform/backend.tfvars locally
    # bucket = <TF_STATE_BUCKET>
    # key    = "loypevaer.no/terraform.tfstate"
    # region = <TF_STATE_REGION>
  }
}

provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
