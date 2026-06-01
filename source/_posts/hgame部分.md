---
title: hgame部分
date: 2026-03-03 18:14:32
tags:
---
## babyrsa
### 关键：m有强结构
m 不是任意整数。
它满足：
$$m = bytes\_to\_long(  
\text{VIDAR{} X \text{ }}  
)$$
其中：
* X 长度已知范围
* X 每个字符来自 64 个字符集
这是一个**强约束结构整数**
---

### 转化为数学方程
设：
* prefix = "VIDAR{"
* suffix = "}"
展开整数形式：
$$m=P\cdot 256^{k+1}+X\cdot256+S$$
我们已知：
$$m \equiv m_0 \pmod n$$
代入得：

$$P \cdot 256^{k+1}  + X\cdot256 + S\equiv m_0 \pmod n$$

整理：

$$X \cdot 256  \equiv  m_0  - P\cdot256^{k+1} -S\pmod n$$

现在问题变成：
求一个长度 k 的整数 X，使得：
1. $X \equiv C \mod n$
2. X 的每个字节来自 64 个合法字符

### 恢复X
$$X = \sum x_i 256^i$$
我们可以写成：
$$x_i = a + \delta_i$$
$$\sum \delta_i 256^i  \equiv  C'  \pmod n$$
变形：
$$\sum \delta_i 256^i - C' = t n$$
可以构造：
$$L =  
\begin{pmatrix}  
1 & 0 & 0 & … & 0 & 256^0 \\  
0 & 1 & 0 & … & 0 & 256^1 \\  
0 & 0 & 1 & … & 0 & 256^2 \\  
\vdots & & & \ddots & & \vdots \\  
0 & 0 & 0 & … & 1 & 256^{k-1} \\  
0 & 0 & 0 & … & 0 & -C' \\  
0 & 0 & 0 & … & 0 & n  
\end{pmatrix}$$
$$(\delta_0, \delta_1, …, \delta_{k-1}, t)L = (\delta_0,  \delta_1,  …, \delta_{k-1},  1, \sum \delta_i 256^i - C' + t n = 0)$$
如果这最后两维是 1，0，那我们就得到了合法解。
### EXP
```PY
def solve():

    c = 451420045234442273941376910979916645887835448913611695130061067762180161
    p = 722243413239346736518453990676052563
    q = 777452004761824304315754169245494387
    e = 65537

    n = p * q
    phi = (p - 1) * (q - 1)
    
    d = pow(e, -1, phi)
    m_trunc = pow(c, d, n)

    prefix = b"VIDAR{"
    suffix = b"}"
    center = 85

    # 3. 遍历爆破中间字符的长度
    for length in range(30, 41):
        print(f"尝试未知长度 k = {length}")
        
        target = m_trunc
        # 减去前缀和后缀的权重 (使用 Python 自带的 int.from_bytes)
        target -= (256**(len(suffix) + length)) * int.from_bytes(prefix, 'big')
        target -= int.from_bytes(suffix, 'big')
        # 消除后缀长度的偏移
        target = (target * pow(256, -1, n)) % n
        
        # 4. 构建格矩阵
        L = Matrix(ZZ, length + 2, length + 2)
        
        for i in range(length):
            L[i, i] = 1
            L[i, -1] = 256**i
            target -= (256**i) * center
            
        L[-2, -2] = 1
        L[-2, -1] = -target
        L[-1, -1] = n
        
        for i in range(length + 2):
            L[i, -1] *= n
            
        res = L.BKZ()
        
        for row in res:
            if all(-38 <= x <= 38 for x in row[:-2]):
                if row[-2] == 1:
                    flag_middle = "".join(chr(center + j) for j in row[:-2][::-1])
                    print(f"\nk = {length}")
                    print(f"Flag: {prefix.decode()}{flag_middle}{suffix.decode()}\n")
                    return
                    
                elif row[-2] == -1:
                    flag_middle = "".join(chr(center - j) for j in row[:-2][::-1])
                    print(f"\nk = {length}")
                    print(f"Flag: {prefix.decode()}{flag_middle}{suffix.decode()}\n")
                    return

solve()
```