#!/bin/bash
usage()
{
   echo "options:"
   echo "    -i install path"
   echo "    -s sdk path"
   echo "    -m module name. i.e, core/manage"
   echo
   echo "usage: "
   echo "    ./install.sh -i path -s sdk path -m core"
}

SdkPath=".."
InstallPath=".."
ModuleName="core"
while getopts i:s:m:h flag
do
    case "${flag}" in
        i) InstallPath="${OPTARG}";;
        s) SdkPath="${OPTARG}";;
	m) ModuleName="${OPTARG}";;
        h) usage && exit 1;;
    esac
done

GetVersion()
{
  PackagePath=${SdkPath}/../../../../../../package-lock.json
  InputKey="name\": \"@firebolt-js/openrpc"
  LineNo="$(grep -n "${InputKey}" ${PackagePath} | head -n 1 | cut -d: -f1)"
  VersionLine=$((LineNo++))
  eval "array=(`sed -n "${LineNo}p" < ${PackagePath} | sed 's/\"/\n/g'`)"
  Version=${array[2]}
}

Version=0.0
GetVersion
ReleaseName=firebolt-${ModuleName}-native-sdk-${Version}
ReleasePath=${InstallPath}/${ReleaseName}

rm -rf ${ReleasePath}
mkdir -p ${ReleasePath}
cp -ar ${SdkPath}/src ${ReleasePath}
cp -ar ${SdkPath}/include ${ReleasePath}
cp -ar ${SdkPath}/cmake ${ReleasePath}
cp -ar ${SdkPath}/scripts/build.sh ${ReleasePath}
cp -ar ${SdkPath}/CMakeLists.txt ${ReleasePath}
cp -ar ${SdkPath}/cpptest ${ReleasePath}/test

sed -i '/EnableTest="ON";;/d' ${ReleasePath}/build.sh
sed -i 's/getopts p:s:tch/getopts p:s:ch/g' ${ReleasePath}/build.sh
sed -i '/enable test/d' ${ReleasePath}/build.sh
sed -i '/EnableTest="OFF"/d' ${ReleasePath}/build.sh
sed -i 's/ -DENABLE_TESTS=${EnableTest}//g' ${ReleasePath}/build.sh

cd ${ReleasePath}/../
tar -cvzf ${ReleaseName}.tgz ${ReleaseName}/*
cd -
