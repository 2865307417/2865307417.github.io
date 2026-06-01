---
title: unictf
date: 2026-02-26 16:06:33
tags:
---
# unictf
## Subgroup-Weaver解题步骤：
分析代码，发现求出正确的key发给服务器就可以拿到flag

key的产生:
> key = randbytes(64)#64字节随机
 

分析这个随机数生成器发现问题 : `randint(1, 7) % 2`输出1和0的概率并不相等，存在统计偏差
因此，每一位生成的概率分布为：
$P(\text{random\_bit} = 1) = 4/7 \approx 57.14\%$
$P(\text{random\_bit} = 0) = 3/7 \approx 42.86\%$

题目中的加密方式是：output = key ^ random_stream
如果 $k_i = 0$：$\text{output}_i = 0 \oplus \text{random}_i = \text{random}_i$。此时输出位的分布与随机流相同，$1$ 出现的概率约为 57%。如果 $k_i = 1$：$\text{output}_i = 1 \oplus \text{random}_i = \neg \text{random}i$（取反）。此时输出$1$ 出现的概率变为 $3/7$，约为 42%。
利用这个概率差（约 14%），我们可以通过收集大量的输出来推测每一位 key 的值。
对于第$i$来说 如果output为 1 的频率小于 50%，说明 $k_i = 1$。反值则为$0$

### exp：
```py
from pwn import *
from Crypto.Util.number import long_to_bytes
import sys

context.log_level = 'info'
io = remote('nc1.ctfplus.cn', 15215)

def get_otp_samples(count=1200):
    samples = []
    print(f"[*] Collecting {count} samples")
    
    for i in range(count):
        # 进度条
        if i % 100 == 0:
            sys.stdout.write(f'\r{i}')
            sys.stdout.flush()
            
        io.sendlineafter(b'> ', b'') 
        line = io.recvline().strip()
        try:
            samples.append(int(line))
        except ValueError:
            pass
    return samples

def recover_key(samples, bit_length=512):
    """通过统计偏差恢复密钥"""
    recovered_key_int = 0
    
    for i in range(bit_length):
        ones_count = 0
        for num in samples:
            if (num >> i) & 1:
                ones_count += 1
        
        freq = ones_count / len(samples)

        if freq < 0.5:
            recovered_key_int |= (1 << i)
            
    return recovered_key_int

def main():

    samples = get_otp_samples(1000)
    
    key_int = recover_key(samples)
    key_bytes = long_to_bytes(key_int)
    key_hex = key_bytes.hex()
    
    print(f"[+] Recovered Key (Hex): {key_hex}")
    
    print("[*] Sending key...")
    io.sendlineafter(b'> ', key_hex.encode())

    response = io.recvline()
    print(f"{response.decode().strip()}")
if __name__ == '__main__':
    main()
```

## NTRU解题步骤：
点名了ntru问题，加密公式为：
$$c \equiv r \cdot h + m \pmod q$$
题目明确给出 $r$ 只有 4 个非零系数，且系数只能是 $\pm 1$，我们直接去爆破r就好
再去
$$m \equiv c - r \cdot h \pmod q$$
### exp(ai梭的)：
```py
import itertools

# 题目参数
N = 31
p = 257
q = 12289
h = [9603, 11838, 1242, 5868, 12249, 3130, 3722, 5910, 5879, 7672, 1119, 339, 10748, 7310, 6370, 9353, 10589, 10739, 10213, 2560, 5132, 4889, 11292, 2649, 2556, 8037, 3146, 9533, 11563, 1554, 304]
c = [91, 11459, 932, 4345, 12153, 9504, 5147, 7268, 2493, 8891, 8712, 5785, 11608, 7683, 11327, 8453, 10380, 6004, 7849, 1622, 6154, 10369, 10278, 769, 11676, 11492, 4564, 5445, 10909, 11502, 12216]

def solve():
    print(f"[*] 开始穷举 r (权重=4, N={N})...")
    
    for indices in itertools.combinations(range(N), 4):
        
        for signs in itertools.product([-1, 1], repeat=4):
            
            rh = [0] * N
            
            for i in range(4):
                idx = indices[i] # r 非零项的位置
                sgn = signs[i]   # r 非零项的值 (+1 或 -1)
                
                # 累加到 rh 向量中
                for k in range(N):
                    # 循环卷积下标计算：(k - idx) % N
                    # rh[k] += r[idx] * h[k-idx]
                    val = (sgn * h[(k - idx) % N])
                    rh[k] = (rh[k] + val) % q

            # 4. 计算 m = c - rh (mod q)
            m_candidate = []
            valid_ascii = True
            
            for k in range(N):
                val = (c[k] - rh[k]) % q
                # 检查解出来的值是否像 ASCII 字符
                if not (0 <= val < 128): 
                    valid_ascii = False
                    break
                m_candidate.append(val)
            
            # 5. 如果看起来像 Flag，输出结果
            if valid_ascii:
                # 尝试转成字符串
                try:
                    flag = "".join(chr(x) for x in m_candidate)
                    # 简单的启发式检查：通常 flag 包含 "{" 或 "flag" 或字母
                    if "{" in flag or "flag" in flag.lower() or "ctf" in flag.lower():
                        print(f"\n[+] 找到潜在 Flag!")
                        print(f"Indices: {indices}")
                        print(f"Signs: {signs}")
                        print(f"Message (int): {m_candidate}")
                        print(f"Flag: {flag}")
                        return
                except:
                    pass

if __name__ == "__main__":
    solve()
```

## subgroup_dlp解题步骤：
离散对数问题
问题就要是解方程
$$c \equiv 7^m \pmod n$$
注意到这里的n是一个偶数，结合同余的性质，可以考虑分解因子n，拆分同余方程后再使用中国剩余定理求解。
在factordb上分解：
![alt text](image.png)

$$n = 2^5 \cdot 3^2 \cdot p_1 \cdot p_2^3 \cdot p_3$$
分别求解：
解$7^{m_1} \equiv c \pmod {2^5}$
解$7^{m_2} \equiv c \pmod {3^2}$
解$7^{m_3} \equiv c \pmod {p_1}$
解$7^{m_4} \equiv c \pmod {p_2^3}$
解$7^{m_5} \equiv c \pmod {p_3}$
$2^5 ，3^2$小因子及p-1光滑的$p_1,p_3$可以直接在$sagemath$里$discrete_log$函数求解
对于$p_2$的方法则是先求出 $7^{m_4} \equiv c \pmod {p_2}$再去升次
完成后在crt合并就好

### 解题脚本(东拼西凑的)：
```py
from sage.all import *
from Crypto.Util.number import long_to_bytes

# ================= 题目数据 =================
n = 20416580311348568104958456290409800602076453150746674606637172527592736894552749500299570715851384304673805100612931000268540860237227126141075427447627491168
c = 8195229101228793312160531614487746122056220479081491148455134171051226604632289610379779462628287749120056961207013231802759766535835599450864667728106141697

p1 = 10711086940911733573
p2 = 188455199626845780197
p3 = 988854958862525695246052320176260067587096611000882853771819829938377275059

#p2笔者选择单独处理
factors = [2**5, 3**2, p1, p3]

# ================= 求解过程 =================

remainders = []
moduli = []

for factor in factors:
    R = Integers(factor)
    g_val = R(7)
    c_val = R(c)
        
    # 求阶
    order = g_val.multiplicative_order()
        
    # 求解离散对数
    dlog = discrete_log(c_val, g_val, ord=order)
        
    remainders.append(dlog)
    moduli.append(order)

# 手动处理 p2^3 的部分 
R = Integers(p2)
g_val = R(7)
c_val = R(c)
order = g_val.multiplicative_order()

dlog = discrete_log(c_val, g_val, ord=order)
def linear_lift(g, c, p, k):
    """
    功能: 求解 g^x = c mod p^k
    原理: 先求 x0 = dlog(c) mod p, 然后线性提升到 p^k
    """
    # 1. 基础解: mod p
    x = discrete_log(GF(p)(c), GF(p)(g))
    
    # 2. 线性提升: 逐层修正
    # 每一层修正量 d 满足线性方程: d * alpha = beta mod p
    for i in range(1, k):
        mod = p**(i+1)
        
        # 计算当前偏差 beta = L(c * g^-x)
        # 即 (c / g^x - 1) / p^i
        curr_val = power_mod(g, x, mod)
        chk = (c * inverse_mod(curr_val, mod)) % mod
        beta = (chk - 1) // p**i
        
        # 计算梯度 alpha = L(g^phi_prev)
        # 即 (g^((p-1)p^(i-1)) - 1) / p^i
        step_pow = (p-1) * p**(i-1)
        base = power_mod(g, step_pow, mod)
        alpha = (base - 1) // p**i
        
        # 解 d 并更新 x
        d = (beta * inverse_mod(alpha, p)) % p
        x += d * step_pow
        
    return x

m4 = linear_lift(7, c, p2, 3)
print(f'{m4}')
remainders.append(m4)

'''
据说sage好像可以自动升次？？？
但笔者这里的是ai梭的 p-adic
'''

#计算 p2^3 对应阶
p2_pow_3 = p2**3
order_p2 = Integers(p2_pow_3)(7).multiplicative_order()
moduli.append(order_p2)
print(f"解: {remainders}")
print(f"模: {moduli}")
        

#crt部分

m = crt(remainders, moduli)
print(f"m: {m}")
    
flag = long_to_bytes(m)
print(f"\n{flag.decode()}")


'''
3607318467090477073783352030357123895792830141955325751309814
解: [0, 1, 1224347636342905336, 106155541015491325739788391904987578874651584430962292283925150916550296688, 3607318467090477073783352030357123895792830141955325751309814]
模: [4, 3, 1785181156818622262, 988854958862525695246052320176260067587096611000882853771819829938377275058, 3346527342866541318314435408576449342128783035050376199173282]
m: 4474399909953905361921883374365168306769114394248549045511770939283217915925636422542946623049100947407711381893061133594122679245785692770312361479241728

UniCTF{Th1s_DLP_probl3m_i5_v3ry_s1mpl3_f0r_y0u!!!}

'''
```
## subgroup_Scribe
### 1.题目到底干嘛？
服务端会玩 128 轮游戏。
每一轮：
* 它随机生成一个 key
* 你发一段数据 msg 给它
* 它会利用key对你的msg加密
* 然后随机决定：
    * 要么发真实加密结果
    * 要么发同长度随机字符串
* 你要猜：这是不是“真的加密结果”

连续猜对 128 次给 flag。
#### 所以目标是：

-  设计一个特殊的 msg  
 - 让“真加密”一定有某种规律  
- “随机串”几乎不可能有这种规律

然后稳定区分
### 2.加密
ECB 模式：
代码把 msg 分成 16 字节一块  
每一块单独加密
但是有个关键点：
代码每加密完一块，key 会变一次
变的方法是：
代码key 的每个字节都过一遍 sbox
也就是：
代码key -> s(key)
#### 漏洞：
这个 sbox 有个性质：

它循环 128 次就会回到原值

代码key1  
key2 = sbox(key1)  
key3 = sbox(key2)  
...
那么：
代码key129 = key1
### 3.现在的目标变成：
设计两个 block：
- block1  
- block129

让它们在“同 key”下加密时，  
输出之间存在某种“特殊关系”。
这样：
* 真加密 → 一定满足关系
* 随机串 → 几乎不可能满足

第一个块：
代码[0,0,0,0]
第二个块：
代码[1,1,1,0]
那么：
[0, 0, 0, 0] 的输出状态可表示为：
$$[C_1, C_2, C_3, C_4]$$
而 [1, 1, 1, 0] 的输出状态会紧紧跟随着它，变为：
$$[1 \oplus C_1, 1 \oplus C_2, 1 \oplus C_3, T(C_1 \oplus C_2 \oplus C_3 \oplus C_4 \oplus k_4 \oplus 1)]$$
我们就可以依靠这个进行判断:
把它们俩做异或（也就是求差异），前三个字的结果会是：
第 1 个字：$C_1 \oplus (1 \oplus C_1) = \mathbf{1}$
第 2 个字：$C_2 \oplus (1 \oplus C_2) = \mathbf{1}$
第 3 个字：$C_3 \oplus (1 \oplus C_3) = \mathbf{1}$
所以有`diff_words[0], [1], [2]`
重点在第四个
$T(x) \oplus T(x \oplus 1)$
对应$\Delta = T(x) \oplus T(x \oplus 1)$
只会有256种可能!
### 4.攻击思路
我们提前算好这 256 种可能：
```py
delta_list = {  
   T(i) xor T(i xor 1)  
   for i in range(256)  
}
```
存到一个列表
每轮：

1. 发 129 个 block
2. 收到 hint
3. 取：
    * 第 1 块密文
    * 第 129 块密文
4. 做异或
5. 看是否落在那 256 种差分里

如果在：
代码说明大概率是真加密
如果不在：
代码说明是随机串
循环128轮就好

#### 怎么算出的128种可能?
```
代码x  =  [ B3 ] [ B2 ] [ B1 ] [ B0 ]  
          ↑高字节              ↓低字节（最低 8bit）
```
而 `1` 在 32-bit 里是：
```
    1 = 0x00000001  
    [ 00 ] [ 00 ] [ 00 ] [ 01 ]
```
所以：

代码x ⊕ 1 只会影响最低字节 B0（因为只有最后那个 01 在动）
也就是：
```
x       = [ B3 ] [ B2 ] [ B1 ] [ B0 ]  
x⊕1    = [ B3 ] [ B2 ] [ B1 ] [ B0⊕01 ]  
前3个字节完全不变
```
过 tau（逐字节 sbox）时，变化“仍然只在 1 个字节”
```
tau(x)     = [ S(B3) ] [ S(B2) ] [ S(B1) ] [ S(B0) ]  
tau(x⊕1)  = [ S(B3) ] [ S(B2) ] [ S(B1) ] [ S(B0⊕01) ]
```
于是 tau 后的差分（异或）是：

$Δtau = tau(x) ⊕ tau(x⊕1)  
     = [ 00 ] [ 00 ] [ 00 ] [ S(B0) ⊕ S(B0⊕01) ]
$
前三个字节一定是 0，因为完全相同。
* `B0` 的取值只有 `0..255` 共 **256** 种
* 所以 `S(B0) ⊕ S(B0⊕1)` 只由 B0 决定,最多也就 256 种
* 过线性层 L 后，还是256种(线性的变化不会改变)
本地的计算表:
```py
def rotl(x, n):
    return ((x << n) & 0xFFFFFFFF) | (x >> (32 - n))

def tau(a):
    return ((sbox[(a >> 24) & 0xFF] << 24) |
            (sbox[(a >> 16) & 0xFF] << 16) |
            (sbox[(a >>  8) & 0xFF] <<  8) |
             sbox[a & 0xFF])

def L(b):
    return b ^ rotl(b, 2) ^ rotl(b, 10) ^ rotl(b, 18) ^ rotl(b, 24)

def T(x):
    return L(tau(x))

delta_set = set()
for d in range(256):
    x  = d                  # 0x000000d
    dx = T(x) ^ T(x ^ 1)    # 注意：x^1 只翻转最低bit，所以只影响最低字节
    delta_set.add(dx)

# delta_set 里面就是“所有可能的差分”（大小 <= 256）
```
### 5.exp
```py
from pwn import remote

HOST = "example.com"
PORT = 1337

DELTA = bytes.fromhex(
    "00000001"
    "00000001"
    "00000001"
    "00000000"
)

def bxor(a: bytes, b: bytes) -> bytes:
    return bytes(x ^ y for x, y in zip(a, b))

def build_msg(T: int = 16) -> bytes:
    blocks = []
    for t in range(T):
        for i in range(128):
            v = (2 * i) & 0xFF  # even => LSB=0
            b = bytearray(16)
            b[0:2]  = t.to_bytes(2, "big")
            b[3]    = v
            b[4:6]  = (t ^ 0x1234).to_bytes(2, "big")
            b[7]    = v
            b[8:10] = (t ^ 0xBEEF).to_bytes(2, "big")
            b[11]   = v
            blocks.append(bytes(b))

    blocks2 = [bxor(b, DELTA) for b in blocks]
    msg = b"".join(blocks + blocks2)

    # 唯一性自检（可留可删）
    assert len(set(msg[i:i+16] for i in range(0, len(msg), 16))) * 16 == len(msg)
    return msg

def decide_coin(hint: bytes, T: int) -> int:
    blocks = [hint[i:i+16] for i in range(0, len(hint), 16)]
    for t in range(T):
        for i in range(128):
            c1 = blocks[t*128 + i]
            c2 = blocks[(T+t)*128 + i]
            d = bxor(c1, c2)
            if 0 in d[12:16]:   # last 32-bit word bytes contain 0
                return 1        # random
    return 0                    # real encryption

def main():
    T = 16
    msg = build_msg(T).hex().encode()

    io = remote(HOST, PORT)

    for r in range(128):
        io.recvuntil(b"msg > ")
        io.sendline(msg)

        line = io.recvline().decode().strip()
        assert line.startswith("hint: ")
        hint_hex = line.split("hint: ", 1)[1]
        hint = bytes.fromhex(hint_hex)

        io.recvuntil(b"give me coin > ")
        io.sendline(str(decide_coin(hint, T)).encode())

    print(io.recvall().decode(errors="ignore"))

if __name__ == "__main__":
    main()
``` 
## subgroup_lattice
### 题目在干什么？
```Python
class PRNG:  
    def __init__(self, state):  
        self.mask = 2147483647   # m = 2^31-1  
        self.state = [s & self.mask for s in state]  
  
    def next(self):  
        tmp = 0  
        for i in range(len(self.state)):  
            tmp = (tmp + self.state[i] * C[i]) % self.mask  
        self.state = self.state[1:] + [tmp]  
        return tmp  
  
    def getrandbits(self, k):  
        return self.next() >> (self.mask.bit_length() - k)
```
这就是：

$$a_{i+16} = \sum_{j=0}^{15} C_j a_{i+j} \pmod m$$

其中：

* 阶数 n = 16
* 模数 m = 2³¹−1
* 只输出 **高 17 位**
* 低 14 位被截断

即：

$$a_i = 2^{14} y_i + z_i$$

* $y_i$ 已知（hint）
* $z_i < 2^{14}$ 未知

---
程序最后判断：`if ans == sum(s):`

要恢复初始 state $s_0, …, s_{15}$
反复拷打ai发现都卡在c未知了，到这里就初见端倪
想着可能是最近的论文题
去eprint搜lfsr结果还真让我找到了
<https://eprint.iacr.org/2025/2323.pdf>
照着上面的方法来就好
### 1.分析
有一个 Fibonacci Z/(m)-LFSR：

$$a_{i+n} ≡ c_{n-1}a_{i+n-1}+…+c_0a_i \pmod m$$
且每个数被截断：
$$a_i = 2^{β}y_i + z_i$$

* y_i：已知高位
* z_i：未知低位
* 0 ≤ z_i < 2^β
目标：
> 用 y_i 恢复 c_i 和初始状态。

论文的关键是：
不直接猜系数。
而是先找一个多项式 F(x)，使得：
$$F(a_i) ≡ 0 \pmod m$$
即:
$$\sum η_i a_{i+j} ≡ 0 \pmod m$$
这种多项式叫：
> $annihilating polynomial(消去多项式)$

---
为什么这么做？
因为：
真实特征多项式
$$f(x)=x^n-c_{n-1}x^{n-1}-…-c_0$$
一定整除所有 $annihilating polynomial$。
所以：
只要找到几个 $annihilating polynomial$
对它们求 gcd
就能得到真正的 f(x)
#### 2.解答
如何去求解消去多项式$F(x)=η_0+η_1x+…+η_{r-1}x^{r-1}$?
我们做一些推导：

消去多项式满足
$$η=(η_0,…,η_{r-1})$$
$$\sum_{i=0}^{r-1} η_i a_{i+j} ≡ 0 \pmod m$$
运用已知：$a_i=2^{β}y_i+z_i$
代入：
$$\sum η_i(2^{β}y_i+z_i) ≡ 0 \pmod m$$
整理：
$$2^{14} \sum_{i=0}^{r-1} \eta_i y_{i+j} \equiv - \sum_{i=0}^{r-1} \eta_i z_{i+j} \pmod m$$
等式右边的 $z_{i+j}$ 是非常小的（只有 14 位，小于 $2^{14}$）。如果多项式的系数 $\eta_i$ 也很小，那么整个等式右边的值就会远小于模数 $m$ 。也就是说，我们要求一组小系数 $\eta_i$，使得等式左边的计算结果对 $m$ 取模后也非常小
契合了最短向量问题

按论文造格：
收集141组hint的输出
$$a_0,a_1,\cdots,a_{140}$$
$\left(\begin{matrix}
m&&&&&&&&\\
&m&&&&&&&\\
&&\ddots&&&&&&\\
&&&m&&&&&\\
Ka_0&Ka_1&\cdots&Ka_{t-1}&K&&&\\
Ka_1&Ka_2&\cdots&Ka_{t}&&K&&\\
\vdots&\vdots&&\vdots&&&\ddots&\\
Ka_{r-1}&Ka_{r}&\cdots&Ka_{140}&&&&K\\
\end{matrix}\right)$
其中$K=2^{14},r=t=71$
取前$s(s\ge 2)$个短向量的前$t$个分量除以$K$之后构造$\mathbb{Z}_m$下的多项式$p_1,p_2,\cdots,p_s$，再对这$s$个多项式求gcd就可以得到一个度为16的不可约多项式了
这个多项式就算是
$$f(x)=x^n-c_{n-1}x^{n-1}-…-c_0$$
就可以还原$c_i$了
#### 3.exp
恢复C
```py
from sage.all import *
from pwn import *

# 题目环境参数
m = 2147483647  # 模数 2^31 - 1 (素数)
n = 16          # LFSR 阶数
alpha = 17      # 已知高位比特数
beta = 14       
shift = 2**beta 


r = 80
t = 80

# 需要获取的 hint 数量 (N = r + t - 1)
# 多取几个防止边界溢出
num_hints = r + t + 5 

# 配置日志
context.log_level = 'info'

# ================= 2. 数据收集 =================
def get_hints():
    # 连接到远程服务器
    # 请根据实际情况修改 IP 和端口
    try:
        io = remote("nc1.ctfplus.cn", 31840)
    except:
        print("[-] 连接失败，请检查网络或题目地址")
        exit(0)
    
    hints = []
    print(f"[*] 正在收集 {num_hints} 个 Hint 数据 (用于恢复系数)...")
    
    # 进度条
    p = log.progress("Fetching")
    
    for i in range(num_hints):
        io.sendlineafter(b">>> ", b"2")
        io.recvuntil(b"hint: ")
        line = io.recvline().strip()
        try:
            hints.append(int(line))
        except ValueError:
            p.failure(f"收到无效数据: {line}")
            exit(0)
            
        if i % 10 == 0:
            p.status(f"{i}/{num_hints}")
            
    p.success(f"成功收集 {len(hints)} 个数据")
    io.close() # 恢复系数阶段只需要数据，断开连接无妨
    return hints

# ================= 3. 构建格与恢复系数 =================
def recover_coefficients(hints):
    print(f"[*] 构建格矩阵 L (维度: {r+t} x {r+t})...")
    
    # 根据论文公式 (3) 构建格 L_{m,y} [cite: 282]
    # Matrix Structure:
    # [ m * I_t       0            ]
    # [ 2^beta * Y    2^beta * I_r ]
    
    dim = t + r
    L = Matrix(ZZ, dim, dim)
    
    # 1. 左上角: m * I_t
    for i in range(t):
        L[i, i] = m
        
    # 2. 下半部分: 构造关联矩阵
    # 每一行对应一个移位的 hint 向量 Y_i = (y_i, y_{i+1}, ..., y_{i+t-1})
    for i in range(r):
        # 提取长度为 t 的向量 Y_i
        vec_y = hints[i : i+t]
        
        # 填充左下角: 2^beta * Y_i
        for j in range(t):
            L[t+i, j] = shift * vec_y[j]
        
        # 填充右下角: 2^beta * I_r (用于记录多项式系数 eta)
        L[t+i, t+i] = shift

    print("[*] 正在运行 BKZ-20 格规约算法 (可能需要 10-30 秒)...")
    # 论文实验表明 BKZ-20 对于 ZUC 规模的问题是必要的 [cite: 398]
    L_red = L.BKZ(block_size=20)
    
    print("[*] 格规约完成，正在提取零化多项式...")
    
    # 在有限域 GF(m) 上定义多项式环
    F = GF(m)
    P_ring = PolynomialRing(F, 'x')
    x = P_ring.gen()
    
    candidates = []
    
    # 遍历规约后基底的每一行
    for row_idx in range(dim): 
        row = L_red[row_idx]
        
        # 验证向量格式: 后 r 位必须是 2^beta 的倍数
        # 向量格式: [ residual_0 ... | coeff_0*shift ... coeff_{r-1}*shift ]
        coeffs = []
        valid = True
        
        for j in range(r):
            val = row[t+j]
            if val % shift != 0:
                valid = False
                break
            coeffs.append(val // shift)
            
        if valid:
            # 构造多项式 P(x) = sum(eta_i * x^i)
            # 注意: 格构造隐含的关系是 sum(eta_i * Y_{k+i}) = 0
            poly = sum(coeffs[j] * (x**j) for j in range(r))
            
            # 过滤无效多项式 (0 或 度数小于 n)
            if poly != 0 and poly.degree() >= n:
                candidates.append(poly)
    
    print(f"[*] 找到 {len(candidates)} 个候选多项式。")
    if not candidates:
        print("[-] 未找到有效多项式，请尝试增加 r 和 t 的值。")
        return None

    print("[*] 正在通过 GCD 计算特征多项式...")
    
    # 迭代 GCD 策略：寻找所有候选者的最大公因式
    # 只要数据量足够，它们的 GCD 就会收敛到唯一的特征多项式 f(x)
    final_poly = candidates[0]
    
    for i in range(1, min(20, len(candidates))): # 取前20个足够了
        # 计算 GCD
        next_poly = gcd(final_poly, candidates[i])
        
        # 如果 GCD 变成常数(互质)，说明其中混入了噪声向量
        if next_poly.degree() == 0:
            continue
            
        final_poly = next_poly
        
        # 如果度数收敛到 16，我们就找到了！
        if final_poly.degree() == n:
            print(f"[+] 成功锁定度数为 {n} 的多项式！")
            break
            
    # 归一化 (Monic)
    final_poly = final_poly.monic()
    
    if final_poly.degree() != n:
        print(f"[-] 警告: 最终多项式度数为 {final_poly.degree()} (期望 {n})。")
        print("[-] 可能是数据不足或参数 r/t 需要调整。")
        return None
        
    print(f"[*] 特征多项式: {final_poly}")
    
    # 提取系数 C
    # 定义: a_{i+n} = sum(C_k * a_{i+k})
    # 特征方程: f(x) = x^n - sum(C_k * x^k)
    # 因此: C_k = - (f(x) 中 x^k 的系数)
    recovered_C = []
    for i in range(n):
        c = -final_poly[i]
        recovered_C.append(int(c))
        
    print("\n" + "="*50)
    print(f"[SUCCESS] 系数 C 恢复成功!")
    print(f"C = {recovered_C}")
    print("="*50 + "\n")
    
    return recovered_C

# ================= 4. 主程序 =================
if __name__ == '__main__':
    hints = get_hints()
    C = recover_coefficients(hints)
```
拿到c后
```py
from sage.all import *
from pwn import *

# ================= 参数保持不变 =================
m = 2147483647
n = 16
beta = 14
shift = 2**beta
# 你的系数
RECOVERED_C = [917898012, 28106733, 958044358, 1874624539, 1643434479, 
               2065268907, 1803916914, 220312944, 2114416305, 766033324, 
               1403211654, 1125402953, 1442047323, 1942246698, 2099402234, 1086003163]

context.log_level = 'info'

def get_hints():
    # io = process(["python3", "main.py"])
    io = remote("nc1.ctfplus.cn", 43119)
    
    # 获取足够多的样本，建议 50 个以保证约束力
    num_hints = 50 
    hints = []
    print(f"[*] Collecting {num_hints} hints...")
    for i in range(num_hints):
        io.sendlineafter(b">>> ", b"2")
        io.recvuntil(b"hint: ")
        hints.append(int(io.recvline().strip()))
    return io, hints

def recover_state(hints, C):
    print("[*] Recovering hidden low-bits (z) ...")
    
    samples = len(hints)
    
 
    # 构造转移矩阵 T
    T = Matrix(GF(m), n, n)
    for i in range(n-1): T[i, i+1] = 1
    for i in range(n): T[n-1, i] = C[i]
    
    M_gen = Matrix(GF(m), samples, n)

    print("[*] Using Error-Recovery Lattice Strategy (LWE style)...")
    
    # 1. 生成所有线性关系
    # s_k = \sum M_{k,j} s_j
    M_all = Matrix(GF(m), samples, n)
    A_all = vector(GF(m), samples) # 观测值 (hints << beta)
    
    T_curr = T
    for k in range(samples):
        row = T_curr.row(n-1)
        for j in range(n): M_all[k, j] = row[j]
        # 观测值中心化
        A_all[k] = hints[k] * shift + shift//2 
        T_curr = T_curr * T
    
    M0 = M_all[:n, :]
    M1 = M_all[n:, :]
    A0 = A_all[:n]
    A1 = A_all[n:]
    
    try:
        M0_inv = M0.inverse()
    except:
        print("[-] Matrix not invertible, need more samples or luck.")
        return None
        
    # 转移矩阵 U = M1 * M0^{-1}
    U = M1 * M0_inv
    
    # 常数项 V = A1 - U * A0
    V = A1 - U * A0
    

    
    dim_eq = samples - n
    dim_vars = samples
    dim_total = dim_eq + dim_vars + 1
    
    L = Matrix(ZZ, dim_total, dim_total)
    
    # 1. Modulo constraints for equations
    for i in range(dim_eq):
        L[i, i] = m
        
    for i in range(n):
        # Fill H^T part (which corresponds to columns of U)
        for k in range(dim_eq):
            L[dim_eq + i, k] = int(U[k, i])
        L[dim_eq + i, dim_eq + i] = 1 # Measure length of e_i
        
    for i in range(dim_eq):
        row_idx = dim_eq + n + i
        L[row_idx, i] = -1 # The -I part of H
        L[row_idx, row_idx] = 1 # Measure length
        
    # 3. Target
    for k in range(dim_eq):
        L[dim_total-1, k] = -int(V[k])
    L[dim_total-1, dim_total-1] = shift # Weight for the '1'
    
    print(f"[*] Lattice built. Dimension: {dim_total}. Solving for errors...")
    
    L_red = L.BKZ(block_size=20) # Use BKZ for better quality
    
    for row in L_red:
        if abs(row[dim_total-1]) == shift:
            print("[+] Found potential error vector!")
            # Extract errors
            errors = []
            sign = 1 if row[dim_total-1] > 0 else -1
            
            # The middle block (dim_vars size) contains the errors
            for i in range(dim_vars):
                val = row[dim_eq + i] * sign
                errors.append(val)
                
            # Check if errors are small
            # They should be around [-shift/2, shift/2]
            if all(abs(e) < shift for e in errors):
                print(f"[+] Errors are small: {errors[:5]}...")
                
                # Recover s_init using s = M0^{-1} (A0 + e_top)
                # e_top is errors[:n]
                e_top = vector(GF(m), errors[:n])
                s_recovered = M0_inv * (A0 + e_top)
                
                # Verify
                s_list = [int(x) for x in s_recovered]
                print(f"[+] Recovered State: {s_list}")
                return sum(s_list)
            else:
                # pass
                continue
                
    return None

if __name__ == '__main__':
    # 建立连接
    io, hints = get_hints()
    
    # 恢复系数 (使用硬编码的 C)
    print(f"[*] Using recovered coefficients: {RECOVERED_C}")
    
    # 恢复状态 (使用 LWE/Lattice 策略)
    ans = recover_state(hints, RECOVERED_C)
    
    if ans:
        print(f"\n[SUCCESS] Calculated sum: {ans}")
        
        # 发送选项 1
        io.sendlineafter(b">>> ", b"1")
        
        # 发送答案
        io.sendlineafter(b"answer: ", str(ans).encode())
        
        # [关键修改] 不要使用 interactive()
        # 直接读取剩余的所有输出（包含 Flag），解码后打印
        try:
            flag_data = io.recvall(timeout=2) # 设置超时防止卡死
            print("\n" + "="*30)
            print("SERVER RESPONSE (FLAG):")
            print(flag_data.decode(errors='ignore'))
            print("="*30 + "\n")
        except Exception as e:
            print(f"Error reading flag: {e}")
            
        io.close()
    else:
        print("[-] State recovery failed.")
        io.close()
```