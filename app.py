import streamlit as st
import pandas as pd
from streamlit_autorefresh import st_autorefresh

st.set_page_config(page_title="Daily NSE Scanner", layout="wide")

st.title("📊 Daily NSE Pattern Scanner")
st.caption("Auto-updated after GitHub Actions run")

# 🔁 Auto refresh every 2 minutes
st_autorefresh(interval=120_000, key="refresh")

CSV_URL = f"https://raw.githubusercontent.com/bhavya-1204/pattern-stock-fetching/master/latest_output.csv"

@st.cache_data(ttl=60)
def load_data(url):
    return pd.read_csv(url)

try:
    df = load_data(CSV_URL)

    if not df.empty:
        st.success(f"Patterns found: {len(df)}")
        st.dataframe(df, use_container_width=True)

        # last updated time
        if "scan_time" in df.columns:
            last_update = pd.to_datetime(df["scan_time"].iloc[0])
            st.caption(f"🕒 Last scan: {last_update}")
    else:
        st.warning("Scanner ran, but no patterns found.")

except Exception:
    st.error("Waiting for latest scan output…")
