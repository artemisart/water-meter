# water-meter

## Installation

### Raspberry-pi - Arduino ethernet connection

To directly connect the Arduino to the RPi, run:

```bash
sudo ip address add 10.0.0.1/24 dev eth0
```

This sets the RPi IP to 10.0.0.1. Arduino is set to 10.0.0.2. Test the connection with `ping 10.0.0.2`.

### InfluxDB

Start influxdb with `docker compose up -d`.

### Setup GUI: open browser on boot

To start midori automatically we can use LXDE settings, write the following to `~/.config/lxsession/LXDE-pi/autostart`:

```
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
#@xscreensaver -no-splash
point-rpi
@python -m http.server --directory water-meter/front/
@midori -e Fullscreen http://localhost:8000/
```
