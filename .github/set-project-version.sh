#!/bin/bash
#
# This script takes care of setting proper version in project modules
#
set -eo pipefail

VERSION=$1

sed -i "s/\"version\": \"\([^\"]*\)\"\+/\"version\": \"${VERSION}\"/g" "browser-extension/package.json"
