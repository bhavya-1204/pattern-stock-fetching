import pandas as pd
import numpy as np
import yfinance as yf
import warnings
import requests
from io import StringIO

# Suppress warnings
warnings.filterwarnings('ignore')
pd.options.mode.chained_assignment = None

def calculate_ema(df, period):
    """
    Calculate Exponential Moving Average (EMA) for a given period.
    Returns None if insufficient data.
    """
    if len(df) < period:
        return None
    return df['Close'].ewm(span=period, adjust=False).mean()

def poles(data):
  final_results = data['Volume'].max().item()
  return final_results

def flag(data, stock_ticker): # Added stock_ticker parameter
  # The `result` variable was not used. Removed.
  # Correct way to get stock name from the ticker
  stock_name = stock_ticker.replace('.NS', '')

  if data.empty:
      return False, None, None, None

  price = data['Close'].iloc[-1].item()
  main_candle = poles(data)

  # Check if main_candle (max volume) exists in data. If not, can't proceed.
  # Use any() with np.isclose for robust float comparison
  if not any(np.isclose(data['Volume'], main_candle)):
      return False, None, None, None

  main_candle_date = data[np.isclose(data['Volume'], main_candle)].index[0]
  main_candle_idx = data.index.get_loc(main_candle_date)
  main_candle_high = data['High'].iloc[main_candle_idx].item()
  main_candle_low = data['Low'].iloc[main_candle_idx].item()
  main_candle_open = data['Open'].iloc[main_candle_idx].item()
  main_candle_close = data['Close'].iloc[main_candle_idx].item()

  count = 0
  till_condition = len(data) - main_candle_idx

  if main_candle_close > main_candle_open and till_condition>10:

    for i in range(main_candle_idx+1, len(data)):
      # If this condition is met, explicitly return to avoid implicit None
      if main_candle_idx+8 > len(data):
        return False, None, None, None

      flag_close = data['Close'].iloc[i].item()
      flag_open = data['Open'].iloc[i].item()
      # flag_high = data['High'].iloc[i].item()
      flag_low = data['Low'].iloc[i].item()
      flag_09ema = data['09_ema'].iloc[i].item()
      flag_20ema = data['20_ema'].iloc[i].item()

      # If EMA is NaN, it's not a valid flag condition. Explicitly return.
      if pd.isna(flag_09ema) or pd.isna(flag_20ema):
        return False, None, None, None

      if flag_09ema < flag_20ema:
        return False, None, None, None

      if flag_close > main_candle_high or flag_open < main_candle_low or flag_low < main_candle_low or flag_close < main_candle_low or flag_close < flag_09ema:
        return False, None, None, None
      else:
        count+=1
        if count>=till_condition-1:
          end_date = data.index[i].date()
          return True, stock_name, price, end_date

  # If the loop finishes or doesn't execute (e.g., range is empty),
  # this ensures a tuple is always returned instead of implicit None.
  return False, stock_name, price, None

def index():
  all_results = []
  session = requests.Session()

  headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.nseindia.com/"
  }

  session.get("https://www.nseindia.com", headers=headers)  # First hit homepage
  response = session.get(
      "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
      headers=headers
  )
  symbol_name_csv = pd.read_csv(StringIO(response.text))
  nse_stock = [symbol + '.NS' for symbol in symbol_name_csv['SYMBOL']]
  for ticker in nse_stock:
    data = yf.download(ticker, period='150d', interval='1d', progress=False) #1

    # Check if data is not empty and meets price condition
    if not data.empty and round(data['Close'].iloc[-1].item(),2) >= 100 and data['Volume'].iloc[-1].item() > 150000:
      data['09_ema'] = calculate_ema(data,9)
      data['20_ema'] = calculate_ema(data,20)
      data = data.tail(20).round(2)

      # Pass ticker to the flag function
      flagi, stock_name, price, end_date = flag(data, ticker) # Modified call site

      if flagi:
        all_results.append({
            'ticker name' : stock_name,
            'price' : price,
            'end date': end_date
        })

  if all_results:
    return pd.DataFrame(all_results)
  else:
    return pd.DataFrame() # Return an empty DataFrame if no results

if __name__ == "__main__":
    stock = index()
