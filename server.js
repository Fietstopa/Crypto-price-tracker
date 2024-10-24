const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const moment = require("moment");
const fs = require("fs");
mongoose
  .connect(
    "mongodb+srv://bmisko984:Imacvonbohdy27@hopaserver.stgwb.mongodb.net/TICKER?retryWrites=true&w=majority&appName=hopaSERVER"
  )
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch(() => console.log("MongoDB connection error"));

const tickerSchema = new mongoose.Schema({
  symbol: String,
  bybitPrice: Number,
  binancePrice: Number,
  whitebitPrice: Number,
  kucoinPrice: Number,
  OKXPrice: Number,
  HTXPrice: Number,
  averagePrice: Number,
  timestamp: Number,
});

const Ticker = mongoose.model("kolekce", tickerSchema);
const app = express();
const port = 3000;
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const convertUnixToReadable = (timestamp) => {
  return moment.unix(timestamp).format("DD-MM-YYYY HH:mm:ss");
};

const convertReadableToUnix = (readableTime) => {
  return moment(readableTime, "DD-MM-YYYY HH:mm:ss").unix();
};
const logErrorToFile = (error, symbol) => {
  const logFilePath = path.join(__dirname, "error.log");
  const logMessage = `[${convertUnixToReadable(
    Math.floor(Date.now() / 1000)
  )}] Error in fetching or saving price data for ${symbol}: ${
    error.message
  };\n`;

  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error("Failed to write to log file:", err);
    }
  });
};

const getBybit = async (symbol) => {
  try {
    symbol = symbol.replace("_", "");
    const response = await axios.get(
      `https://api-testnet.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`
    );
    const price = response.data.result.list[0].usdIndexPrice;
    return parseFloat(price);
  } catch (error) {
    console.error("Error fetching price from Bybit:", error);
    return null;
  }
};
const getBinance = async (symbol) => {
  try {
    symbol = symbol.replace("_", "");

    const response = await axios.get(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`
    );
    const price = response.data.price;
    return parseFloat(price);
  } catch (error) {
    console.error("Error fetching price from Binance:", error);
    return null;
  }
};
const getWhiteBit = async (symbol) => {
  try {
    const response = await axios.get(
      `https://whitebit.com/api/v4/public/ticker`
    );
    const price = response.data[symbol].last_price;
    return parseFloat(price);
  } catch (error) {
    console.error("Error fetching price from whitebit:", error);
    return null;
  }
};
const getKucoin = async (symbol) => {
  try {
    symbol = symbol.replace("_", "-");
    const response = await axios.get(
      `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}`
    );
    const price = response.data["data"].price;
    return parseFloat(price);
  } catch (error) {
    console.error("Error fetching price from whitebit:", error);
    return null;
  }
};
const getOKX = async (symbol) => {
  try {
    symbol = symbol.replace("_", "-");
    const response = await axios.get(
      `https://www.okx.com/api/v5/market/ticker?instId=${symbol}`
    );
    const price = response.data.data[0].last;
    return parseFloat(price);
  } catch (error) {
    console.error("Error fetching price from whitebit:", error);
    return null;
  }
};
const getHTX = async (symbol) => {
  try {
    symbol = symbol.replace("_", "");
    const response = await axios.get(
      `https://api.htx.com/market/detail/merged?symbol=${symbol}`
    );
    const price = response.data.tick["close"];
    return parseFloat(price);
  } catch (error) {
    console.error("Error fetching price from htx:", error);
    return null;
  }
};

const fetchAndStorePrices = async (symbol) => {
  let symbolUpper = symbol.toUpperCase();
  let symbolLower = symbol.toLowerCase();

  try {
    const bybitPrice = await getBybit(symbolUpper);
    const binancePrice = await getBinance(symbolUpper);
    const whitebitPrice = await getWhiteBit(symbolUpper);
    const kucoinPrice = await getKucoin(symbolUpper);
    const OKXPrice = await getOKX(symbolUpper);
    const HTXPrice = await getHTX(symbolLower);
    const unixTimestamp = Math.floor(Date.now() / 1000);

    if (
      bybitPrice &&
      binancePrice &&
      whitebitPrice &&
      kucoinPrice &&
      OKXPrice &&
      HTXPrice
    ) {
      const averagePrice =
        (bybitPrice +
          binancePrice +
          whitebitPrice +
          kucoinPrice +
          OKXPrice +
          HTXPrice) /
        6;

      const newTicker = new Ticker({
        symbol: symbolUpper,
        bybitPrice: bybitPrice,
        binancePrice: binancePrice,
        whitebitPrice: whitebitPrice,
        kucoinPrice: kucoinPrice,
        OKXPrice: OKXPrice,
        HTXPrice: HTXPrice,
        averagePrice: averagePrice,
        timestamp: unixTimestamp,
      });

      await newTicker.save();
    } else {
      console.error(`Failed to fetch prices for ${symbolUpper}`);
      logErrorToFile(
        new Error(`Failed to fetch prices for ${symbolUpper}`),
        symbolUpper
      );
    }
  } catch (error) {
    console.error("Error in fetching or saving price data:", error);
  }
};

const symbolsToFetch = [
  "BTC_USDT",
  "ETH_USDT",
  "SOL_USDT",
  "XRP_USDT",
  "DOGE_USDT",
];
symbolsToFetch.forEach((symbol) => {
  setInterval(() => fetchAndStorePrices(symbol), 1000);
});

app.get("/price/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const readableTimestamp = req.query.timestamp;

  try {
    let query;

    if (readableTimestamp) {
      const targetUnixTimestamp = convertReadableToUnix(readableTimestamp);

      query = Ticker.findOne({
        symbol: symbol,
        timestamp: { $lte: targetUnixTimestamp },
      }).sort({ timestamp: -1 });
    } else {
      query = Ticker.findOne({ symbol }).sort({ timestamp: -1 });
    }

    const data = await query.exec();

    if (data) {
      res.json({
        symbol: data.symbol,
        prices: {
          bybit: data.bybitPrice,
          binance: data.binancePrice,
          whitebit: data.whitebitPrice,
          kucoin: data.kucoinPrice,
          OKX: data.OKXPrice,
          HTX: data.HTXPrice,
          timestamp: convertUnixToReadable(data.timestamp),
        },
        averagePrice: data.averagePrice,
      });
    } else {
      res.status(404).json({ error: "No price data found for the symbol" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error fetching price data from MongoDB" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
