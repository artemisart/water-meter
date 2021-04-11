# water-meter

## Raspberry-pi - Arduino ethernet connection

To directly connect the Arduino to the RPi, run:
```bash
sudo ip address add 10.0.0.1/24 dev eth0
```
This sets the RPi IP to 10.0.0.1. Arduino is set to 10.0.0.2.