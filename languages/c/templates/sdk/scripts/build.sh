#!/bin/bash
usage()
{
   echo "options:"
   echo "    -p sdk path"
   echo "    -s sysroot path"
   echo "    -t enable test"
   echo "    -c clear build"
   echo "    -h : help"
   echo
   echo "usage: "
   echo "    ./build.sh -p path -tc"
}

SdkPath="."
EnableTest="OFF"
SysrootPath=${SYSROOT_PATH}
ClearBuild="N"
while getopts p:s:tch flag
do
    case "${flag}" in
        p) SdkPath="${OPTARG}";;
        s) SysrootPath="${OPTARG}";;
        t) EnableTest="ON";;
        c) ClearBuild="Y";;
        h) usage && exit 1;;
    esac
done

if [ "${ClearBuild}" == "Y" ];
then
    rm -rf ${SdkPath}/build
fi

cmake -B${SdkPath}/build -S${SdkPath} -DSYSROOT_PATH=${SysrootPath} -DENABLE_TESTS=${EnableTest}
cmake --build ${SdkPath}/build
cmake --install ${SdkPath}/build --prefix=${SdkPath}/build/Firebolt
