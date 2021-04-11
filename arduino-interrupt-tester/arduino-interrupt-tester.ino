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

volatile float state = 0;
volatile unsigned long lastInterrupt = 0;

void onImpulse() {
  if (lastInterrupt + 10 < millis()) {
    state += 0.5;
  }
  lastInterrupt = millis();
}

void setup()
{
    Serial.begin(115200);
    pinMode(3, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(3), onImpulse, CHANGE);
}


void loop()
{
    print(state);
    state = 0;
    delay(10);
}
