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

void setup()
{
  Serial.begin(115200);
  pinMode(A0, INPUT_PULLUP);
  print("min value max");
}

void loop() {
  print(0, ' ', analogRead(A0), ' ', 1024);
  delay(1);
}
