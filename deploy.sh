#!/bin/bash

# Musical Playground Deployment Script
# Builds and deploys the application to the flappynote.com S3 bucket
# and invalidates the matching CloudFront distribution.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎵 Musical Playground Deployment Script${NC}\n"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create a .env file with the following variables:"
    echo "  VITE_GA_MEASUREMENT_ID"
    echo "  AWS_ACCESS_KEY_ID"
    echo "  AWS_SECRET_ACCESS_KEY"
    echo "  AWS_ACCOUNT_ID"
    exit 1
fi

# Load environment variables
source .env

# Verify required environment variables
if [ -z "$AWS_ACCESS_KEY_ID" ]; then
    echo -e "${RED}❌ Error: AWS_ACCESS_KEY_ID not set in .env${NC}"
    exit 1
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
    echo -e "${RED}❌ Error: AWS_SECRET_ACCESS_KEY not set in .env${NC}"
    exit 1
fi

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Error: AWS_ACCOUNT_ID not set in .env${NC}"
    exit 1
fi

# Verify AWS credentials and account ID
echo -e "${YELLOW}🔍 Verifying AWS credentials...${NC}"
ACTUAL_ACCOUNT_ID=$(AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} aws sts get-caller-identity --query 'Account' --output text 2>&1)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to authenticate with AWS${NC}"
    echo "$ACTUAL_ACCOUNT_ID"
    exit 1
fi

if [ "$ACTUAL_ACCOUNT_ID" != "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Error: AWS Account ID mismatch${NC}"
    echo "Expected: $AWS_ACCOUNT_ID"
    echo "Actual: $ACTUAL_ACCOUNT_ID"
    exit 1
fi

echo -e "${GREEN}✅ AWS credentials verified (Account: $ACTUAL_ACCOUNT_ID)${NC}\n"

# Build the application
echo -e "${YELLOW}📦 Building application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete${NC}\n"

# Deploy to S3
echo -e "${YELLOW}☁️  Deploying to S3...${NC}"
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
    aws s3 sync dist/ s3://flappynote.com/ --delete

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: S3 deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Deployed to S3${NC}\n"

# Get CloudFront distribution ID
echo -e "${YELLOW}🔍 Finding CloudFront distribution...${NC}"
DISTRIBUTION_ID=$(AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
    aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items[?contains(@, 'flappynote.com')]].Id" \
    --output text)

if [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${YELLOW}⚠️  Warning: CloudFront distribution not found. Skipping cache invalidation.${NC}"
else
    echo -e "${GREEN}✅ Found distribution: $DISTRIBUTION_ID${NC}\n"

    # Invalidate CloudFront cache
    echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
    INVALIDATION_ID=$(AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
        aws cloudfront create-invalidation \
        --distribution-id $DISTRIBUTION_ID \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text)

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Error: CloudFront invalidation failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Cache invalidation created: $INVALIDATION_ID${NC}\n"
fi

# Summary
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "🌐 Your site is available at:"
echo -e "   ${GREEN}https://flappynote.com${NC}"
echo ""
if [ ! -z "$DISTRIBUTION_ID" ]; then
    echo -e "⏱️  CloudFront cache invalidation is in progress."
    echo -e "   Changes will be visible within 1-2 minutes."
fi
echo ""
