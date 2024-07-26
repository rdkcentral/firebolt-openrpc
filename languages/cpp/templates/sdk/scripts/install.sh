#!/bin/bash
usage()
{
   echo "options:"
   echo "    -i install path"
   echo "    -s sdk path"
   echo "    -m module name. i.e, core/manage"
   echo "    -v sdk version. i.e, 1.3.0 "
   echo
   echo "usage: "
   echo "    ./install.sh -i path -s sdk path -m core"
}

SdkPath=".."
InstallPath=".."
ModuleName="core"
Version=1.3.0-next.1

while getopts i:s:m:v:h flag
do
    case "${flag}" in
        i) InstallPath="${OPTARG}";;
        s) SdkPath="${OPTARG}";;
        m) ModuleName="${OPTARG}";;
        v) Version="${OPTARG}";;
        h) usage && exit 1;;
    esac
done

GetVersion()
{
  PackagePath=${SdkPath}/../../../../../../package-lock.json
  InputKey="\"@firebolt-js/openrpc\":"
  Line=$(grep -n "${InputKey}" ${PackagePath})
  if [[ "${Line}" == *"file:"* ]]; then
    InputKey="name\": \"@firebolt-js/openrpc"
    Line=$(grep -n "${InputKey}" ${PackagePath})
    LineNo="$(echo ${Line} | head -n 1 | cut -d: -f1)"
    VersionLine=$((LineNo++))
  else
    LineNo="$(echo ${Line} | head -n 1 | cut -d: -f1)"
  fi
  eval "array=(`sed -n "${LineNo}p" < ${PackagePath} | sed 's/\"/\n/g'`)"
  Version=${array[2]}
}

#GetVersion
ReleaseName=firebolt-${ModuleName}-native-sdk-${Version}
ReleasePath=${InstallPath}/${ReleaseName}

rm -rf ${ReleasePath}
mkdir -p ${ReleasePath}
cp -aR ${SdkPath}/src ${ReleasePath}
cp -aR ${SdkPath}/include ${ReleasePath}
cp -aR ${SdkPath}/cmake ${ReleasePath}
cp -aR ${SdkPath}/scripts/build.sh ${ReleasePath}
cp -aR ${SdkPath}/CMakeLists.txt ${ReleasePath}
cp -aR ${SdkPath}/cpptest ${ReleasePath}/test

sed -i'' -e '/EnableTest="ON";;/d' ${ReleasePath}/build.sh
sed -i'' -e 's/getopts p:s:tch/getopts p:s:ch/g' ${ReleasePath}/build.sh
sed -i'' -e '/enable test/d' ${ReleasePath}/build.sh
sed -i'' -e '/EnableTest="OFF"/d' ${ReleasePath}/build.sh
sed -i'' -e 's/ -DENABLE_TESTS=${EnableTest}//g' ${ReleasePath}/build.sh

cd ${ReleasePath}/../
tar -cvzf ${ReleaseName}.tgz ${ReleaseName}/*
cd -
