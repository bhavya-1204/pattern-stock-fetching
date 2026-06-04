import streamlit as st
import os

# ---------- Page config ----------
st.set_page_config(
    page_title="Stock Selection Dashboard",
    page_icon="📈",
    layout="wide"   # changed to wide for better 3-column layout
)

# ---------- Custom CSS ----------
st.markdown("""
<style>
.main-title {
    text-align: center;
    font-size: 42px;
    font-weight: 700;
    margin-bottom: 10px;
}
.sub-title {
    text-align: center;
    color: #6c757d;
    margin-bottom: 40px;
}
.card {
    background: #ffffff;
    border-radius: 16px;
    padding: 30px;
    text-align: center;
    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
    transition: transform 0.2s ease-in-out;
}
.card:hover {
    transform: translateY(-5px);
}
.card-title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 10px;
}
.card-desc {
    color: #6c757d;
    margin-bottom: 20px;
}
</style>
""", unsafe_allow_html=True)

# ---------- Header ----------
st.markdown('<div class="main-title">📈 STOCK SELECTION DASHBOARD</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Rocket Base, F&O and VCP scanner</div>', unsafe_allow_html=True)

# ---------- Last Updated Timestamp ----------
timestamp_file = "last_updated.txt"
if os.path.exists(timestamp_file):
    with open(timestamp_file, "r") as f:
        last_updated = f.read().strip()
    st.markdown(
        f'<div class="timestamp">🕒 Last updated: {last_updated}</div>',
        unsafe_allow_html=True
    )

# ---------- 3 Column Layout ----------
col1, col2, col3 = st.columns(3, gap="large")

# ---------- Pattern Scanner ----------
with col1:
    st.markdown("""
    <div class="card">
        <div class="card-title">📊 Pattern Stocks</div>
        <div class="card-desc">
            Detect high-probability chart patterns using EMA & price action.
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.page_link(
        "pages/Rocket_base.py",
        label="RB Scanner",
        icon="➡️"
    )

# ---------- F&O Scanner ----------
with col2:
    st.markdown("""
    <div class="card">
        <div class="card-title">⚡ Futures & Options</div>
        <div class="card-desc">
            Identify momentum-based F&O stocks with EMA & volume logic.
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.page_link(
        "pages/future_option.py",
        label="F&O Scanner",
        icon="➡️"
    )

# ---------- VCP Scanner ----------
with col3:
    st.markdown("""
    <div class="card">
        <div class="card-title">📈 VCP Scanner</div>
        <div class="card-desc">
            Detect Volatility Contraction Pattern (VCP) stocks using EMA & contraction logic.
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.page_link(
        "pages/vcp_result.py",
        label="VCP Scanner",
        icon="➡️"
    )

# ---------- Footer ----------
st.markdown("---")
st.markdown('<div class="sub-title">Made by BHAVYA PATEL</div>', unsafe_allow_html=True)
