import streamlit as st
import pandas as pd
from pathlib import Path

st.set_page_config(page_title="Daily NSE Scanner", layout="wide")

st.title("📊 Daily NSE Pattern Scanner")
st.caption("Auto-updated after GitHub Actions run")

FILE = Path(__file__).parent / "latest_output.csv"

# --- Manual refresh button (no reboot) ---
if st.button("🔄 Refresh data"):
    st.rerun()

# --- Always read fresh file ---
if FILE.exists():
    df = pd.read_csv(FILE)

    if not df.empty:
        st.success(f"Patterns found: {len(df)}")
        st.dataframe(df, use_container_width=True)
    else:
        st.warning("Scanner ran, but no patterns found.")
else:
    st.error("latest_output.csv not found yet.")
