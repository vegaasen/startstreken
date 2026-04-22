variable "aws_region" {
  description = "Primary AWS region (where the S3 bucket lives)"
  type        = string
  default     = "eu-north-1"
}

variable "domain_name" {
  description = "Root domain name (e.g. loypevaer.no)"
  type        = string
  default     = "xn--lypevr-tua3l.no"
}

variable "s3_bucket_name" {
  description = "Name of the S3 bucket used for site hosting"
  type        = string
  default     = "loypevaer-no-site"
}

variable "cloudfront_price_class" {
  description = "CloudFront price class - PriceClass_100 covers EU + North America (cheapest)"
  type        = string
  default     = "PriceClass_100"
}
