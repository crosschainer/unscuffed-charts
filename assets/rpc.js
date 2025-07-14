const RPCURL = "https://node.xian.org";
(function(e) {
    async function s(e) {
        try {
            let t = await fetch(e);
            if (!t.ok)
                return showToast("RPC error!", "error", 2e3),
                console.log(t),
                !1;
            let n = await t.json();
            return n
        } catch (e) {
            return showToast("RPC error!", "error", 2e3),
            console.error(e),
            !1
        }
    }
    async function r(e) {
        try {
            let t = await fetch(`${RPCURL}/graphql`, {
                method: `POST`,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: `{allStates(condition: {key: "${e}"}) {edges{node{value}}}}`
                })
            });
            if (!t.ok)
                return showToast("RPC error!", "error", 2e3),
                console.log(t),
                !1;
            let n = await t.json();
            return n
        } catch (e) {
            return showToast("RPC error!", "error", 2e3),
            console.error(e),
            !1
        }
    }
    e.request_graphi = async function(e) {
        try {
            let t = await fetch(`${RPCURL}/graphql`, {
                method: `POST`,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: e
                })
            });
            if (!t.ok)
                return showToast("RPC error!", "error", 2e3),
                console.log(t),
                !1;
            let n = await t.json();
            return n
        } catch (e) {
            return showToast("RPC error!", "error", 2e3),
            console.error(e),
            !1
        }
    }
    ;
    async function t(e) {
        let t = await s(`${RPCURL}/abci_query?path=%22/get/${e}%22`);
        return !!t && !!t.result && t.result.response.value
    }
    function i(e, t) {
        return e != !1 && t != !1 && (rv = ["0.0", "0.0"],
        e != null && (rv[0] = atob(e)),
        t != null && (rv[1] = atob(t)),
        rv)
    }
    function a(e) {
        return e != !1 && (e == null ? "0.0" : atob(e))
    }
    function n(e) {
        return !!e && e != null && atob(e)
    }
    function o(e) {
        return Array.from(e, function(e) {
            return ("0" + (e & 255).toString(16)).slice(-2)
        }).join("")
    }
    e.getReserves = async function(e, n) {
        let s = await t(`${e}.pairs:${n}:reserve0`)
          , o = await t(`${e}.pairs:${n}:reserve1`);
        return i(s, o)
    }
    ,
    e.getLiqBalances = async function(e, n) {
        let s = await t(`${e}.pairs:${n}:balance0`)
          , o = await t(`${e}.pairs:${n}:balance1`);
        return i(s, o)
    }
    ,
    e.getBalance = async function(e, t) {
        let i = {
            sender: t,
            contract: e,
            function: "balance_of",
            kwargs: {
                address: t
            }
        }
          , a = (new TextEncoder).encode(JSON.stringify(i))
          , n = await s(`${RPCURL}/abci_query?path="/simulate_tx/${o(a)}"`);
        return !!n && !!n.result && (console.log(n),
        !isNaN(JSON.parse(atob(n.result.response.value)).result) && JSON.parse(atob(n.result.response.value)).result)
    }
    ,
    e.getFarmsInfo = async function(e, t, n) {
        let a = {
            sender: t,
            contract: e,
            function: "call",
            kwargs: {
                who: t,
                farms: n
            }
        }
          , r = (new TextEncoder).encode(JSON.stringify(a))
          , i = await s(`${RPCURL}/abci_query?path="/simulate_tx/${o(r)}"`);
        return !!i && !!i.result && JSON.parse(atob(i.result.response.value)).result
    }
    ,
    e.RPCcall = async function(e, t, n, i) {
        let r = {
            sender: n,
            contract: e,
            function: t,
            kwargs: i
        }
          , c = (new TextEncoder).encode(JSON.stringify(r))
          , a = await s(`${RPCURL}/abci_query?path="/simulate_tx/${o(c)}"`);
        return !!a && !!a.result && JSON.parse(atob(a.result.response.value)).result
    }
    ,
    e.getPair = async function(e, s, o) {
        o < s && ([s,o] = [o, s]);
        let i = await t(`${e}.toks_to_pair:${s}:${o}`);
        return n(i)
    }
    ,
    e.tokenName = async function(e) {
        let s = await t(`${e}.metadata:token_name`);
        return n(s)
    }
    ,
    e.tokenTicker = async function(e) {
        let s = await t(`${e}.metadata:token_symbol`);
        return n(s)
    }
    ,
    e.getLiq = async function(e, s, o) {
        let i = await t(`${e}.pairs:${s}:balances:${o}`);
        return n(i)
    }
    ,
    e.getLiqSupply = async function(e, s) {
        let o = await t(`${e}.pairs:${s}:totalSupply`);
        return n(o)
    }
    ,
    e.getAllowance = async function(e, n, s) {
        let o = await t(`${e}.balances:${n}:${s}`);
        return console.log(o),
        a(o)
    }
    ,
    e.getLiqAllowance = async function(e, n, s, o) {
        let i = await t(`${e}.pairs:${n}:balances:${s}:${o}`);
        return console.log(i),
        a(i)
    }
}
)(window)
