import re, sys, os
base=r"C:\xampp2\htdocs\ipay\frontend"
def rp(rel, old, new):
    p=os.path.join(base,rel)
    s=open(p,encoding="utf-8").read()
    if old not in s:
        print("MISS",rel); return
    open(p,"w",encoding="utf-8",newline="\n").write(s.replace(old,new))
    print("ok",rel)

# explore: avoid setState sync in effect by guarding
rp("app/(tabs)/explore.tsx",
"  useEffect(() => {\n    if (!search || search.length < 3) { setUsers([]); return; }\n    let mounted = true;\n    setVerifying(true);",
"  useEffect(() => {\n    let mounted = true;\n    if (!search || search.length < 3) {\n      const id = setTimeout(() => { if (mounted) { setUsers([]); setVerifying(false); } }, 0);\n      return () => { mounted = false; clearTimeout(id); };\n    }\n    setVerifying(true);")

# index: wrap initial calls in async IIFE inside effect? lint complains calling fetchDashboard which sets state; better move to void async
rp("app/(tabs)/index.tsx",
"  useEffect(() => { fetchDashboard(); syncContacts(); const i = setInterval(fetchDashboard, 60000); return () => clearInterval(i); }, []);",
"  useEffect(() => { void fetchDashboard(); void syncContacts(); const i = setInterval(fetchDashboard, 60000); return () => clearInterval(i); }, []);")

# agent dashboard
rp("app/agent/dashboard.tsx",
"  useEffect(() => { load(); }, []);",
"  useEffect(() => { void load(); }, []);")
rp("app/agent/dashboard.tsx","Today's completed jobs:","Today&apos;s completed jobs:")

# marketplace transaction
rp("app/marketplace/transaction.tsx",
"  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [id]);",
"  useEffect(() => { void load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [id]);")

# transactions
rp("app/transactions.tsx",
"  useEffect(() => { load(); }, []);",
"  useEffect(() => { void load(); }, []);")
print("done")
