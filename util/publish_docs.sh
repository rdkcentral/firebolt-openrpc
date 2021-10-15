#!/bin/bash

# Copyright 2021 Comcast Cable Communications Management, LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

mkdir -p /tmp/firebolt-docs/build
mkdir -p /tmp/firebolt-docs/wiki
mkdir -p /tmp/firebolt-docs/ottxdocs

cp -r ./build/docs/markdown /tmp/firebolt-docs/build

BRANCH="$(git branch --show-current)"

if [ $BRANCH = 'main' ]
then
    echo "Publishing docs to GitHub wiki..."

    cd /tmp/firebolt-docs/wiki/
    git clone git@github.comcast.com:ottx/firebolt-openrpc.wiki.git
    cd firebolt-openrpc.wiki
    rm -r *
    cp -r ../../build/markdown/* ./
    mv ./index.md ./Home.md
    git add --all
    git commit -m 'Publishing docs to wiki'
    git push
else
    echo "Publishing $BRANCH docs to ottx-docs wiki..."

    cd /tmp/firebolt-docs/ottxdocs/
    git clone git@github.comcast.com:ottx/ottx-docs.git
    cd ottx-docs/docs/firebolt/sdk
    rm -r *
    cp -r ../../../../../build/markdown/* .

    git add --all
    git commit -m 'Publishing docs to ottx-docs'
    git push
fi

yes | rm -r /tmp/firebolt-docs
