---
title: DLP-s
date: 2026-2-15 10:22:24
tags:
---

# DLP问题
---

打个比赛碰到了一万种题型，每一种都是牢底坐穿，整合一下吧

---

## 问题描述
DLP的目标是在给定群体 $G$ 和生成元 $g$ 的情况下，找到一个 $x$，使得

$$g^x \equiv h \ (\text{mod} \ p)$$

其中，$p$ 是一个素数，$g$ 是生成元，$h$ 是已知的值，$x$ 是我们要解决的离散对数。

### 常规方法：
#### 1. 整数域的离散对数：
- 暴力搜索
- Baby-step Giant-step 算法
- Pollard’s Rho 算法
- Pohlig-Hellman 算法

在 CTF 实战中，通常不需要手搓实现算法。SageMath 是处理离散对数最核心的工具。它的 discrete_log 函数会自动根据传入的群结构和阶数特征，选择最优的算法。

但是根据实际问题往往直接调用 SageMath 的 discrete_log 函数是没有结果的需要我们手动调整策略

#### 2. 矩阵离散对数：
1. 如果矩阵可对角化：
$$A = P D P^{-1}$$
其中
$$D = \text{diag}(\lambda_1,\dots,\lambda_n)$$
那么：
$$A^x = P D^x P^{-1}$$
而
$$D^x = \text{diag}(\lambda_1^x,\dots,\lambda_n^x)$$
于是：
$$B = A^x$$
等价于
$$\lambda_i^x = \mu_i$$
其中 $\mu_i$ 是 $B$ 的特征值。
可以随便取一组数据运算
2. 如果矩阵不可对角化：
    - Jordan 标准形(用的不多)
    - 更常见但更局限：行列式降维打击
利用：
$$\det(A^k) = \det(A)^k$$
于是：
$$\det(B) = \det(A)^k$$
问题瞬间降级为：
$$k = \log_{\det(A)}(\det(B))$$
1. 模 $p^2$ 下展开 $(I+pX)^k$
---
case:
## 实际问题
### unictf 
```py
from Crypto.Util.number import *


flag = b'UniCTF{???}'
m = bytes_to_long(flag)
n = 20416580311348568104958456290409800602076453150746674606637172527592736894552749500299570715851384304673805100612931000268540860237227126141075427447627491168
print(pow(7,m,n))
# c = 8195229101228793312160531614487746122056220479081491148455134171051226604632289610379779462628287749120056961207013231802759766535835599450864667728106141697
```
#### 分析
问题就要是解方程
$$c \equiv 7^m \pmod n$$
直接 discrete_log 肯定不行， $n$ 不是一个素数，而是一个大合数
结合同余的性质，可以考虑分解因子n，拆分同余方程后再使用中国剩余定理求解
![factordb分解](image-1.png)
1. 
$$n = 2^5 \cdot 3^2 \cdot p_3 \cdot p_4^3 \cdot P_{big}$$ 
2. 拆分同余方程,对每个质因数幂$p_i^{e_i}$
求解:
$$7^{x_i} \equiv c \pmod{p_i^{e_i}}$$
得到$m \equiv x_i \pmod{order_i}$
3. 使用中国剩余定理合并结果

---

注意：这里的$order_i$是底数 7 在模$p_i^{e_i}$下的乘法阶。由于这些阶通常不互质（都是偶数），必须使用扩展的 CRT（处理非互质模数）来求解

---
2^5 ，3^2,$p_3$小因子及p-1光滑的$p_{big}$可以直接在sagemath里discrete_log函数求解
对于$p_2$的方法则是先求出$7^{m_2} \equiv c \pmod {p_2}$再去升次
完成后在crt合并就好
#### exp
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
这题集合了很多DLP问题的常规考点，包括因子分解、同余方程求解、中国剩余定理等。
### hgame
```py
from Crypto.Util.number import long_to_bytes, getPrime
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from base64 import b64encode
import hashlib
from sage.all import *
from secret import getRandomMatrix

with open('flag.txt', 'rb') as f:
    flag = pad(f.read(), AES.block_size)

# Want to factor n? I've already done it! Get it yourself.
n = 144709507748526661267852152217031923282704243254105275252262414154410511284347828603240755427862752297392095652561239549522158121842455510674435510821274029842500154931546666242034086499872050823824437303603895977092291834159890433746969317535636398062008995784281741721729948231010601796589449187553147904043991226174291329
a = Matrix(Zmod(n), getRandomMatrix())

k = getPrime(1000)
b = a ** k

data = [n, a, b]
save(data, "data.sobj")

key = hashlib.md5(long_to_bytes(k)).digest()

cipher = AES.new(key, AES.MODE_ECB)
ciphertext = cipher.encrypt(flag)

print(b64encode(ciphertext).decode())
# ieJNk5335o9lCy6Ar2XymrDy+HVHcQhikluNSra0kBafw1WDCyyuNPkLACeBsavy
```
#### 分析
这题也是一个DLP问题，要求解 $a^k = b \pmod{n}$ 中的 $k$。但此处$a,b$都是矩阵
先按提示将n分解为 $p，q$
分别求解 $a^k = b \pmod{p}$ 和 $a^k = b \pmod{q}$ 中的 $k$再CRT合并

---
1. $a^k = b \pmod{p}$处理：
此处$矩阵可对角化$
所以我们直接取一组特征值运算即可
问题变成：
$$\lambda_i^k = \mu_i$$

1. $a^k = b \pmod{q}$处理:
此处求$a$特征值时会报错，因为这里的$a$无法对角化
要转换思路$→$行列式降维打击
$$\det(A^k) = \det(A)^k$$
于是：
$$\det(B) = \det(A)^k$$
问题瞬间降级为整数域的离散对数为：
$$k = \log_{\det(A)}(\det(B))$$

#### exp 
```py
from sage.all import *
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from Crypto.Util.number import long_to_bytes
import hashlib
from base64 import b64decode

factors = [ 
    282964522500710252996522860321128988886949295243765606602614844463493284542147924563568163094392590450939540920228998768405900675902689378522299357223754617695943,
    511405127645157121220046316928395473344738559750412727565053675377154964183416414295066240070803421575018695355362581643466329860038567115911393279779768674224503
]

data = load("data.sobj")
_, A, B = data[0], data[1], data[2]

rems = []  # 保存每个p下得到的k mod order的结果（余数）
mods = []  # 保存每个p下的order（模数）

for p in factors:
    print(f"\n[*] 正在处理因子: {p}")
    Fp = GF(p)  # 构造有限域GF(p)（模p的整数域）
    Mat_p = MatrixSpace(Fp, A.nrows(), A.ncols())  # 构造GF(p)上的矩阵空间（和A同维度）
    A_p = Mat_p(A)  # 将矩阵A转换到GF(p)上（每个元素模p）
    B_p = Mat_p(B)  # 同理处理矩阵B
    
    # 步骤1：计算A_p的特征多项式和根
    char_poly = A_p.charpoly()  # 求A_p的特征多项式
    roots = char_poly.roots()  # 求特征多项式在GF(p)上的根（特征值）
    roots_count = sum([multiplicity for root, multiplicity in roots])  # 所有根的重数之和

    # 情况1：矩阵可对角化（特征值数量=矩阵维度），用特征值法
    if roots_count == A_p.nrows() and A_p.is_diagonalizable():
        eig_A = A_p.eigenvalues()[0]  # 取A_p的第一个特征值（核心：A^k的特征值=A特征值的k次幂）
        eig_B = B_p.eigenvalues()[0]  # 同理取B_p的第一个特征值
        # 离散对数：求k使得 (eig_A)^k = eig_B（因为B=A^k，所以特征值满足这个关系）
        k_mod = discrete_log(eig_B, eig_A)
        order = eig_A.multiplicative_order()  # 求eig_A的乘法阶（满足x^order ≡ 1 mod p的最小正整数）
        rems.append(k_mod)
        mods.append(order)
        print(f"k mod {order} = {k_mod}")
        
    # 情况2：矩阵不可对角化，用行列式法（降级处理）
    else:
        det_A = A_p.det()  # 求A_p的行列式（矩阵行列式的k次幂=矩阵k次幂的行列式）
        det_B = B_p.det()  # 求B_p的行列式
        # 离散对数：求k使得 (det_A)^k = det_B
        k_mod = discrete_log(det_B, det_A)
        order = det_A.multiplicative_order()  # 求det_A的乘法阶
        rems.append(k_mod)
        mods.append(order)
        print(f"k mod {order} = {k_mod}")      
k = crt(rems, mods)


key = hashlib.md5(long_to_bytes(int(k))).digest()
cipher = AES.new(key, AES.MODE_ECB)
ciphertext = b64decode("ieJNk5335o9lCy6Ar2XymrDy+HVHcQhikluNSra0kBafw1WDCyyuNPkLACeBsavy")


flag = unpad(cipher.decrypt(ciphertext), AES.block_size)
print(flag.decode())
```
其实这里也可以$pq$两个因子都取行列式计算
```py
from sage.all import *
from Crypto.Util.number import *
import hashlib
from Crypto.Cipher import AES
from base64 import b64decode

data = load('data.sobj')
n = data[0]
a = data[1]
b = data[2]

p = 282964522500710252996522860321128988886949295243765606602614844463493284542147924563568163094392590450939540920228998768405900675902689378522299357223754617695943
q = 511405127645157121220046316928395473344738559750412727565053675377154964183416414295066240070803421575018695355362581643466329860038567115911393279779768674224503

factors = [p,q]
remainders = []
moduli = []

for factor in factors:
    R = Integers(factor)
    g_val = R(a.det())
    c_val = R(b.det())
    order = g_val.multiplicative_order()
    dlog = discrete_log(c_val, g_val, ord=order)
    print(f'{dlog}')
    remainders.append(dlog)
    moduli.append(order)

k = crt(remainders, moduli)

key = hashlib.md5(long_to_bytes(int(k))).digest()
cipher = AES.new(key, AES.MODE_ECB)
ciphertext = b64decode("ieJNk5335o9lCy6Ar2XymrDy+HVHcQhikluNSra0kBafw1WDCyyuNPkLACeBsavy")


flag = unpad(cipher.decrypt(ciphertext), AES.block_size)
print(flag.decode())

```
### hgame2
```py
from Crypto.Util.number import long_to_bytes, getPrime
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from base64 import b64encode
import hashlib
from sage.all import *
from secret import getRandomMatrix, get_random_prime

with open('flag.txt', 'rb') as f:
    flag = pad(f.read(), AES.block_size)

p = get_random_prime()
q = get_random_prime()
n = p * p

a = Matrix(Zmod(n), getRandomMatrix())

k = getPrime(660)
b = a ** k

data = [n, a, b]
save(data, "data.sobj")

key = hashlib.md5(long_to_bytes(k)).digest()

cipher = AES.new(key, AES.MODE_ECB)
ciphertext = cipher.encrypt(flag)

print(b64encode(ciphertext).decode())
# Q3UBa1pz1fi35L94peaFbPvpQe4UyXOUif3CKS/CmZdXOiV7bA5NNNjJ1KeUiAFE
```
#### 分析
- 先看n:$n = p*p$，继续分解p
用$Pollard's Rho$撞出一个因子: 688465747867,继续分解无果
- 那么前面 $PohligHellman$ 的方法就不能用了，而且$det(a) = 1$也直接毙掉了靠行列式逃课的方法
- 688465747867并不大，可以直接得到$k(mod 688465747867)$

这里要转换思路
首先证明：
$$\log(1 + p\alpha) \equiv p\alpha \pmod{p^2}$$

根据 p-adic 对数的展开式：
$$\log(1 + p\alpha) = p\alpha - \frac{(p\alpha)^2}{2} + \frac{(p\alpha)^3}{3} - \cdots$$
在模 $p^2$ 下， $p^2 \equiv 0 \pmod{p^2}$，这些项会直接消失。
![推导](image.png)
#### exp
```py
from sage.all import *
import math
import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from Crypto.Util.number import long_to_bytes
import hashlib
from base64 import b64decode


data = load('data.sobj')
n = data[0]
a = data[1]
b = data[2]

p = math.isqrt(n)
print(p)
P = Zp(p, prec=2)
f_A_high = a.charpoly().change_ring(ZZ).change_ring(P)
f_B_high = b.charpoly().change_ring(ZZ).change_ring(P)
la_high = f_A_high.roots(multiplicities=False)[0]
mu_high = f_B_high.roots(multiplicities=False)[0]
order = p - 1
k_=int(((mu_high**order).log() / (la_high**order).log()).lift())

sm_p = 688465747867
la_val = int(la_high.lift())
mu_val = int(mu_high.lift())

power = int(p * ((p - 1) // sm_p))
R = Integers(p**2)
step = p * sm_p

mu_high = f_B_high.roots(multiplicities=False)[0]
mu_val = int(mu_high.lift())
H = R(mu_val) ** power

la_roots = f_A_high.roots(multiplicities=False)

found_k = False

for root_idx, la_high in enumerate(la_roots):

    # 1. 计算 p-adic 大部头的 k_ (主体部分)
    order = p - 1
    k_ = int(((mu_high**order).log() / (la_high**order).log()).lift())
    
    # 2. 计算 sm_p 小群的 k_sm
    la_val = int(la_high.lift())
    G = R(la_val) ** power
    k_sm = discrete_log(H, G, ord=sm_p)
    
    # 3. CRT 拼接基准 res
    res = crt([k_, k_sm], [p, sm_p])
    
    # 4. 爆破验证
    for i in range(2**10):
        k_guess = res + i * step
        if a**k_guess == b:
            print(f"爆破成功")
            print(f"k1: {k_guess}")
            found_k = True
            break
            
    if found_k:
        break


print(f"k2: {res}")
for i in range(2**10):
    k_=res+i*p*sm_p
    if a**k_==b:
        print(i)
        res=k_
        break
print(res)

ct_b64 = "Q3UBa1pz1fi35L94peaFbPvpQe4UyXOUif3CKS/CmZdXOiV7bA5NNNjJ1KeUiAFE"

ct = base64.b64decode(ct_b64)
key = hashlib.md5(long_to_bytes(res)).digest()
pt = unpad(AES.new(key, AES.MODE_ECB).decrypt(ct), 16)
print(pt.decode())

```