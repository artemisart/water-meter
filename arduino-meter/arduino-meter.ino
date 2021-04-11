#include <UIPEthernet.h>

template <typename T>
void print(T t)
{
	Serial.println(t);
}

template <typename T, typename... Args>
void print(T t, Args... args)
{
	Serial.print(t);
	print(args...);
}

byte mac[] = {0xBA, 0xBA, 0xFA, 0xCE, 0x10, 0x10};
byte ip[] = {10, 0, 0, 2};
EthernetClient client;
char post_data[] = "water litres=";

volatile float litres = 0;
volatile unsigned long lastInterrupt = 0;

void setup()
{
	Serial.begin(115200);
	print("Hello");
	Ethernet.begin(mac, ip);
	//	print(
	//		"Ethernet begin ",
	//		"local IP ", Ethernet.localIP(),
	//		" gateway IP ", Ethernet.gatewayIP(),
	//		" Ethernet cable ", Ethernet.linkStatus(), Unknown, LinkON, LinkOFF,
	//		" hardware status ", Ethernet.hardwareStatus());
	pinMode(3, INPUT_PULLUP);
	attachInterrupt(digitalPinToInterrupt(3), onImpulse, CHANGE);
}

void onImpulse()
{
  if (lastInterrupt + 10 < millis()) {
	  litres += 0.5;
  }
  lastInterrupt = millis();
}

void loop()
{
	print(litres);
	if (litres > 0)
	{
		noInterrupts();
		float litresCurrent = litres;
		litres = 0;
		interrupts();
		String data = post_data + String(litresCurrent, 1);

		sendPost(data);
	}
	else
	{
		delay(10);
	}
}

void sendPost(String data)
{
	int ret = client.connect(Ethernet.gatewayIP(), 8086);
	if (ret != 1)
	{
		print(F("Error connecting "), ret);
	}
	else
	{
		client.print(F("POST /write?db=water_meter&precision=ms HTTP/1.1\n"
					   "Content-Length: "));
		client.print(data.length());
		client.print(F("\n"
					   "Content-Type: application/x-www-form-urlencoded\n\n"));
		client.println(data);
	}
	client.stop();
}
