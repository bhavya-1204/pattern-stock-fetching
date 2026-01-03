import streamlit as st
import pandas as pd
import os

st.set_page_config(page_title="Daily NSE Scanner", layout="wide")

st.title("📊 Daily NSE Pattern Scanner")
st.caption("Auto-updated at 4:30 PM IST (Mon–Fri)")

FILE = "latest_output.csv"

if os.path.exists(FILE):
    df = pd.read_csv(FILE)

    if not df.empty:
        st.success(f"Patterns found: {len(df)}")
        st.dataframe(df, use_container_width=True)

        st.download_button(
            "📥 Download CSV",
            data=df.to_csv(index=False),
            file_name="latest_output.csv",
            mime="text/csv"
        )
    else:
        st.warning("Scanner ran today, but no patterns were found.")
else:
    st.error("Scanner has not run yet.")
