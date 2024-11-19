#!/bin/bash

# This script is used to update the Let's Encrypt certificate for the VUB Diving Center website.
# Update the Let's Encrypt certificate and upload it to /ssl/vubdivingcenter.be.crt and /ssl/vubdivingcenter.be.key
# The challenge is done using the HTTP-01 challenge, so the script will create a file in the .well-known/acme-challenge directory
# on the FTP server.

# (c) 2024 Maxim Van de Wynckel <maxim@mvdw-software.com>

## ------------------------------ ##
## Configuration
## ------------------------------ ##
# Set the FTP credentials and domain
FTP_SERVER=$FTP_SERVER # GitHub SECRET
FTP_USERNAME=$FTP_USER # GitHub SECRET
FTP_PASSWORD=$FTP_PASSWORD # GitHub SECRET
DOMAIN_NAME="vubdivingcenter.be"
# Set the path to the certificate files on the server
CERTIFICATE_PATH="/ssl/vubdivingcenter.be.crt"
PRIVATE_KEY_PATH="/ssl/vubdivingcenter.be.key"
# Set the path to the acme-challenge directory on the server
ACME_CHALLENGE_PATH="/web/.well-known/acme-challenge"
## ------------------------------ ##

# Set the path to the acme-challenge directory on the local machine
LOCAL_ACME_CHALLENGE_PATH="/tmp/acme-challenge"
# Create the acme-challenge directory on the local machine
mkdir -p $LOCAL_ACME_CHALLENGE_PATH

# Generate a random string to use as the challenge
CHALLENGE=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

# Create the challenge file
echo $CHALLENGE > $LOCAL_ACME_CHALLENGE_PATH/$CHALLENGE

# Upload the challenge file to the server
lftp -c "open -u $FTP_USERNAME,$FTP_PASSWORD $FTP_SERVER; put $LOCAL_ACME_CHALLENGE_PATH/$CHALLENGE $ACME_CHALLENGE_PATH/$CHALLENGE"

# Update the Let's Encrypt certificate
certbot certonly --manual --preferred-challenges http -d $DOMAIN_NAME

# Download the certificate files
lftp -c "open -u $FTP_USERNAME,$FTP_PASSWORD $FTP_SERVER; get $CERTIFICATE_PATH; get $PRIVATE_KEY_PATH"