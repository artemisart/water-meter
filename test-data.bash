while true
do
    curl -XPOST "localhost:8086/write?db=water_meter&precision=ms" --data-binary "water litres=0.5"
    sleep $(($RANDOM % 10 + 1))
done
