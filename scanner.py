from pattern_fetching import index

df = index()

if not df.empty:
    df.to_csv("latest_output.csv", index=False)
    print("Scan completed")
else:
    # still create file so Streamlit knows scan ran
    df.to_csv("latest_output.csv", index=False)
    print("No patterns found")
