#!/bin/bash
SDK_PATH="."
if [ "$1" != "" ]
then
   SDK_PATH=$1
   echo "inside ${1}"
fi
echo ${SDK_PATH}
rm -rf ${SDK_PATH}/build
cmake -B${SDK_PATH}/build -S${SDK_PATH} -DSYSROOT_PATH=${SYSROOT_PATH}
cmake --build ${SDK_PATH}/build
