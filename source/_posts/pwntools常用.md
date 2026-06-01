---
title: pwntools常用
date: 2025-12-28 22:22:24
tags:
---
# CTF 中 Pwntools 连接场景简单

在CTF中使用pwntools连接靶机是最基础也最核心的操作之一，pwntools提供了简洁的API支持**本地程序调试**、**远程TCP连接**、**串口连接**等多种场景，下面简单说明用法

## 1. 远程连接（最常见）
```python
from pwn import *

# 基本连接
p = remote('靶机IP', 端口号)

# 示例
p = remote('192.168.1.100', 9999)  # 常见端口
p = remote('ctf.example.com', 1337)
p = remote('127.0.0.1', 4444)     # 本地转发
```
## 2. 常用操作示例
```python
# 发送数据
p.send(b'data')        # 发送原始数据
p.sendline(b'data')    # 发送数据+换行
p.sendafter(b'prompt', b'data')  # 接收到prompt后发送

# 接收数据
data = p.recv(100)     # 接收100字节
line = p.recvline()    # 接收一行
p.recvuntil(b'flag:')  # 接收到指定字符串为止

# 交互模式
p.interactive()        # 切换到手动交互
```

## 3.实用技巧
- 使用 `context.log_level = 'debug'` 查看所有通信
- 利用 `pwnlib.util.proc.pidof()` 查找进程
- 通过 `pwnlib.util.cyclic` 生成模式字符串定位溢出偏移

选择哪种方式取决于题目类型（PWN、Web、Crypto等）和部署方式。