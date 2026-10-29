import { InfluxDBClient } from "@influxdata/influxdb3-client";
import dotenv from "dotenv";

dotenv.config();

export const influx = new InfluxDBClient({
  host: "https://us-east-1-1.aws.cloud2.influxdata.com",
  token: process.env.INFLUXDB_TOKEN,
});
