#include <SPI.h>
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

byte mac[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED};
//IPAddress ip(192, 168, 1, 42);
//IPAddress subnet(255, 255, 255, 0);
//IPAddress gateway(192, 168, 1, 254);
//IPAddress remote(216, 58, 214, 78);
//EthernetServer server(80);
EthernetClient client;
char post_data[] = "water litres=";
// int post_data_len = strlen(post_data);

volatile float litres = 0;

void setup()
{
	Serial.begin(250e3);
	print("Ethernet begin ", Ethernet.begin(mac));
	print(Ethernet.localIP());
	print(Ethernet.gatewayIP());
	print("Ethernet cable ", Ethernet.linkStatus());
	//  server.begin();
	pinMode(2, INPUT_PULLUP);
	attachInterrupt(digitalPinToInterrupt(2), onImpulse, CHANGE);
}

void onImpulse()
{
	litres += 0.5;
}

void loop()
{
	if (litres > 0)
	{
		noInterrupts();
		float litresCurrent = litres;
		litres = 0;
		interrupts();
		String data = post_data + String(litresCurrent, 1);

		sendPost(data);
	}
}

void sendPost(String data)
{
	int ret = client.connect(Ethernet.gatewayIP(), 8086);
	if (ret != 1)
	{
		print(F("Error connecting"));
	}
	else
	{
		client.print(F("POST /write?db=water_meter&precision=ms HTTP/1.1\n"
					   "Content-Length: "));
		client.print(data.length());
		client.print(F("\n"
					   "Content-Type: application/x-www-form-urlencoded\n\n"));
		client.println(data);
		print(F("Sent"));
	}
	client.stop();
}
