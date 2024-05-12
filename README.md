# water-meter

## Installation

### Raspberry-pi

```sh
# one time
python -m venv .venv
# uv
curl -LsSf https://astral.sh/uv/install.sh | sh

. .venv/bin/activate.fish
uv pip install litestar uvicorn
```

### Raspberry-pi - Arduino ethernet connection

To directly connect the Arduino to the RPi, **add to crontab** (`crontab -e`):

```bash
@reboot sudo ip address add 10.0.0.1/24 dev eth0
```

This sets the RPi IP to 10.0.0.1. Arduino is set to 10.0.0.2. Test the connection with `ping 10.0.0.2`.

### Setup GUI: open browser on boot

To start midori automatically we can use LXDE settings, write the following to `~/.config/lxsession/LXDE-pi/autostart`:

```
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
#@xscreensaver -no-splash
point-rpi
@cd ~water-meter/back && ../.venv/bin/litestar run --host 0.0.0.0
#@midori -e Fullscreen http://localhost:8086/
@chromium-browser --start-fullscreen http://localhost:8086/
```
