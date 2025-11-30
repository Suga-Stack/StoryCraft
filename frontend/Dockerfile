FROM node:20-alpine

WORKDIR /app

# 复制依赖配置并安装
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 构建生产环境代码，并将结果复制到挂载卷 /output
CMD ["sh", "-c", "npm run build && rm -rf /output/* && cp -r dist/* /output/"]
