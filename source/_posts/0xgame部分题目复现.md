---
title: 0xgame部分题目复现
date: 2026-01-12 12:57:07
tags:
---

# 0xgame
#### 题目:Ez_LCG
```py
#!/usr/local/bin/python
from Crypto.Util.number import *
from secret import flag
import random


class LCG():
    def __init__(self, a, b, m, seed):
        self.a = a
        self.b = b
        self.m = m
        self.state = seed

    def next(self):
        self.state = (self.a * self.state + self.b) % self.m
        return self.state


class RNG():
    def __init__(self, coefficients, seed, MOD=2**20):
        self.coefficients = coefficients
        self.state = seed
        self.f = lambda x: sum(c * (x ** i) for i, c in enumerate(coefficients)) % MOD

    def next(self):
        self.state = self.f(self.state)
        return self.state

    def next_n(self, n):
        for _ in range(n):
            self.next()
        return self.state


def encrypt_flag(flag):
    coefficients = [random.randint(1, 2**20) for _ in range(10)]
    print("Generated coefficients:", coefficients)
    seed = input("Set seed for RNG: ")
    rng = RNG(coefficients, int(seed))
    assert rng.next() != rng.next(), "Weak seed"
    a, b = [rng.next_n(random.randint(1, 1024)) for _ in range(2)]
    encs = []
    for i in flag:
        lcg = LCG(a, b, 2**32 + 1, i)
        for _ in range(random.randint(1, 1024)):
            enc = lcg.next()
        encs.append(enc)
    return encs


assert flag.startswith(b"0xGame{") and flag.endswith(b"}")
flag = flag[7:-1]

print(f"Encrypted flag: {encrypt_flag(flag)}")

```
##### 解答
首先要理解一下
rng是为生成a,b服务的
只要能理解RNG的输出是可以循环就好说了

---
为啥会循环？
- 模 2^20 意味着状态空间是 2^20 ≈ 1,048,576
- 每次next()调用都会根据当前state计算唯一确定的下一个state（通过多项式函数f(x)）
- 根据鸽巢原理：当调用next()的次数超过状态空间大小（1048576 次）时，必然会出现重复的state
---

虽然这个状态空间看似很大，但是我们可以选取合适的seed来达到找一个小循环的目的

服务器给出因子coefficients
如何找合适的seed呢？爆破！

```python
def list_ring(x0):
    lis = [x0]
    while len(lis) <= 3:
        x = f(lis[-1])
        if x in lis:
            return lis
        lis.append(x)

for i in range(MOD):
    if res := list_ring(i):
        print(res)
        print(len(res))
        break
```
那么a，b都是可以遇见的了
使用组合去尝试就好
```
for a, b in product(res, res)
```
完整代码
```py
from itertools import product
from Crypto.Util.number import *
from ast import literal_eval
from pwn import *

context(log_level='debug')
io = remote('nc1.ctfplus.cn',xxxxx)
io.recvuntil(b"Generated coefficients: ")
coefficients = literal_eval(io.recvline().strip().decode())
MOD = 2**20
f = lambda x: sum(c * (x ** i) for i, c in enumerate(coefficients)) % MOD

def list_ring(x0):
    lis = [x0]
    while len(lis) <= 3:
        x = f(lis[-1])
        if x in lis:
            return lis
        lis.append(x)

for i in range(MOD):
    if res := list_ring(i):
        print(res)
        print(len(res))
        break

io.recvuntil(b"Set seed for RNG: ")
io.sendline(str(res[0]).encode())

io.recvuntil(b"Encrypted flag: ")
encs = literal_eval(io.recvline().strip().decode())

def decrypt(a, b, encs):
    MOD = 2**32 + 1
    flag = ""
    for enc in encs:
        state = enc
        found = False
        for i in range(1,1025):
            state = (state - b) * pow(a, -1, MOD) % MOD
            if 32 <= state <= 126: 
                flag += chr(state)
                found = True
                break
        if not found:
            return None
    return flag

for a, b in product(res, res):
    flag = decrypt(a, b, encs)
    if flag:
        print(f"0xGame{{{flag}}}")

```
#### 题目:Ez_LCG
##### 解答
抛砖引玉QwQ

rng是为生成a,b服务的
只要能理解RNG的输出是可以循环就好说了

为啥会循环？
- 模 2^20 意味着状态空间是 2^20 ≈ 1,048,576
- 每次next()调用都会根据当前state计算唯一确定的下一个state（通过多项式函数f(x)）
- 根据鸽巢原理：当调用next()的次数超过状态空间大小（1048576 次）时，必然会出现重复的state
虽然这个状态空间看似很大，但是我们可以选取合适的seed来达到找一个小循环的目的

服务器给出因子coefficients
如何找合适的seed呢？爆破！
```py

def list_ring(x0):
    lis = [x0]
    while len(lis) <= 3:
        x = f(lis[-1])
        if x in lis:
            return lis
        lis.append(x)

for i in range(MOD):
    if res := list_ring(i):
        print(res)
        print(len(res))
        break
```

那么a，b都是可以遇见的了
使用组合去尝试就好
```py
for a, b in product(res, res)


完整代码

from itertools import product
from Crypto.Util.number import *
from ast import literal_eval
from pwn import *

context(log_level='debug')
io = remote('nc1.ctfplus.cn',xxxxx)
io.recvuntil(b"Generated coefficients: ")
coefficients = literal_eval(io.recvline().strip().decode())
MOD = 2**20
f = lambda x: sum(c * (x ** i) for i, c in enumerate(coefficients)) % MOD

def list_ring(x0):
    lis = [x0]
    while len(lis) <= 3:
        x = f(lis[-1])
        if x in lis:
            return lis
        lis.append(x)

for i in range(MOD):
    if res := list_ring(i):
        print(res)
        print(len(res))
        break

io.recvuntil(b"Set seed for RNG: ")
io.sendline(str(res[0]).encode())

io.recvuntil(b"Encrypted flag: ")
encs = literal_eval(io.recvline().strip().decode())

def decrypt(a, b, encs):
    MOD = 2**32 + 1
    flag = ""
    for enc in encs:
        state = enc
        found = False
        for i in range(1,1025):
            state = (state - b) * pow(a, -1, MOD) % MOD
            if 32 <= state <= 126: 
                flag += chr(state)
                found = True
                break
        if not found:
            return None
    return flag

for a, b in product(res, res):
    flag = decrypt(a, b, encs)
    if flag:
        print(f"0xGame{{{flag}}}")
```


#### 题目:Copper!!!.
```py
from Crypto.Util.number import *
from secret import flag

m = bytes_to_long(flag)


p = getPrime(512)
q = getPrime(512)
n = p * q
e = 65537
c = pow(m, e, n)
print(f"n = {n}")
print(f"c = {c}")
print(f"gift = {p >> 242 << 242}")

# n = 92873040755425037862453595432032305849700597051458113741962060511759338242511707376645887864988028778023918585157853023538298808432423892753226386473625357887471318145132753202886684219309732628049959875215531475307942392884965913932053771541589293948849554008069165822411930991003624635227296915315188938427
# c = 78798946231057858237017891544035026520248922588969396262361286907576401467816384819451190528802344534495780520382462432888103466971743435370588783181267466189564132373143717299869053172848786781320750631382630113459268771330862538801774075395201914653025347332312015985213462835680853607187971669296490439714
# gift = 10911712225716809560802315710689854621004330184657267444255298781464639032414821020145885934381310240257843204972266622870698161556175406337237650652528640

```
##### 解答
p高位泄露，用Coppersmith求解就好
```py
from gmpy2 import *
from Crypto.Util.number import *

n = 92873040755425037862453595432032305849700597051458113741962060511759338242511707376645887864988028778023918585157853023538298808432423892753226386473625357887471318145132753202886684219309732628049959875215531475307942392884965913932053771541589293948849554008069165822411930991003624635227296915315188938427
c = 78798946231057858237017891544035026520248922588969396262361286907576401467816384819451190528802344534495780520382462432888103466971743435370588783181267466189564132373143717299869053172848786781320750631382630113459268771330862538801774075395201914653025347332312015985213462835680853607187971669296490439714
p = 10911712225716809560802315710689854621004330184657267444255298781464639032414821020145885934381310240257843204972266622870698161556175406337237650652528640

PR. = PolynomialRing(Zmod(n))

f = p+x
res = f.small_roots(X=2^242, beta=0.5, epsilon=0.02)
p = int(res[0]) + p
q = n // p
print(q)
d = inverse_mod(65537, (p-1)*(q-1))
m = power_mod(c, d, n)
print(long_to_bytes(m))
```
#### 题目:Mid_LLL
```py
import random
from secret import flag
from sympy import Matrix
from Crypto.Util.number import *


msg = [i for i in flag]


def generate_matrix(n, p):
    matrix = []
    for _ in range(n):
        row = [random.randint(0, p) for _ in range(n)]
        matrix.append(row)
    return matrix


matrix = generate_matrix(len(msg), 2**128)
matrix[0] = msg
matrix = Matrix(matrix)

noise = Matrix(generate_matrix(len(msg), 2**128))

with open("./output.txt", "w") as f:
    f.write(str((noise * matrix).tolist()))

```
##### 解答
先看看代码里发生了什么：

- $R = N \times M$
  - $N$ (noise)：一个全是 $2^{128}$ 大小随机数的矩阵。
  - $M$ (matrix)：第一行是 Flag（ASCII 码，数值很小，$<128$），其余行是 $2^{128}$ 大小的随机数。
  - $R$ (output)：我们拿到的结果矩阵。
- 目标：从 $R$ 中还原 $M$ 的第一行（即 Flag）。

关键在于结合线性代数不难发现：$R$ 的每一行都是 $M$ 的行的线性组合：
$$R_{row_i} = N_{i,0} \cdot \text{Flag} + N_{i,1} \cdot M_{row_1} + \dots$$
这里是不是就很熟悉了？构造一个格$M$,对$M$做一个LLL也许就可以得到答案！
```py
output = ...
aaa = Matrix(ZZ, output)
L = aaa.LLL()
print(g:=GCD(L[0]))
print(lis:=list(map(abs, L[0]/g)))
print("".join(map(chr, lis)))
```

#### 题目:Where is my public Key
一个$e$未知的rsa加密黑箱
![alt text](1.jpg)
##### 解答
$$ c \equiv m^e \pmod{n} $$
m可以自定义，c与n已知
题目便成为了一个离散对数问题，此时注意到$p-1$永远光滑，此时便可以确定使用$Pohlig-Hellman方法解决$但是此处不需要我们手搓，直接用sagemath里包装好就好
```py
#与服务器交互拿到数据
#为简化计算我们打一个m = 2交给靶机交互，拿到c
from Crypto.Util.number import *
from gmpy2 import *

c1 = 1004110357630545817311074765090693459204040033207755011932094275908555203208034259186627539702760517778222622235294948447821410668911086052956891332665832
p = 78646795385241335466971628111322052062110333388784897992869461989103306932403
q = 112215922938327387909468272953228363870450000556239972267568652798377484240491
F = Zmod(p*q)
e = discrete_log(F(c), F(2), ord=(p-1)*(q-1))
print(e)
```
拿到e就好说了