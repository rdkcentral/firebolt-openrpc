#!/bin/bash
usage()
{
   echo "options:"
   echo "    -i install path"
   echo "    -s sdk path"
   echo "    -m module name. i.e, core/manage"
   echo "    -v sdk version. i.e, 1.3.0"
   echo
   echo "usage: "
   echo "    ./install.sh -i path -s sdk path -m core"
}

SdkPath=".."
InstallPath=".."
ModuleName="core"

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
chmod +x ${SdkPath}/scripts/build.sh
cp -aR ${SdkPath}/scripts/build.sh ${ReleasePath}
cp -aR ${SdkPath}/CMakeLists.txt ${ReleasePath}
if [[ -e ${SdkPath}/firebolt-${ModuleName}-open-rpc.json ]]; then
  mv ${SdkPath}/firebolt-*open-rpc.json ${ReleasePath}
else
  cp -aR ${SdkPath}/../../../dist/firebolt-*open-rpc.json ${ReleasePath}
fi
cp -aR ${SdkPath}/cpptest ${ReleasePath}/test

sed -i'' \
  -e '/-t enable test/d' \
  -e '/EnableTest="\(ON\|OFF\)"/d' \
  -e 's/getopts p:s:cltbih/getopts p:s:clbih/g' \
  -e '/t) EnableTest=.*;;/d' \
  -e '/-DENABLE_TESTS=${EnableTest}/d' \
  ${ReleasePath}/build.sh

cd ${ReleasePath}/../
tar -cvzf ${ReleaseName}.tgz ${ReleaseName}/*
cd -
