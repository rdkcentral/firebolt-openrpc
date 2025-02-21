#/bin/bash

ignored=" /title\.h /namespace\.h /string\.h parameters/default\.h /void\.cpp >/null\.h /class\.cpp"
for i in $(find -type f \( -name '*.cpp' -o -name '*.h' \) -print); do
  f=$i
  i=${i#./}; i=${i//\//\\/}
  for ign in $ignored; do
    [[ $f =~ $ign$ ]] && continue 2
  done
  if [[ $(wc -l <$f) -le 1 ]]; then
    sed -i '1s|$|/* TE:'"$i"' */|' $f
  else
    sed -i '1i /* TE:'"$i"': */' $f
  fi
done

