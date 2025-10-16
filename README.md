# 人脸情绪识别系统 (Facial Emotion Recognition System)



[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)> 基于RAF-DB数据集训练的完整Web应用系统，支持7种基本情绪识别<div align="center">

[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg)](https://www.tensorflow.org/)

[![Vue](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/)

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)

**基于RAF-DB数据集的人脸情绪识别系统，支持7种基本情绪识别**

[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.x-orange.svg)](https://www.tensorflow.org/)


[![Vue](https://img.shields.io/badge/Vue-3.x-green.svg)](https://vuejs.org/)

---

[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 项目概述

## 📋 项目概述

完整的人脸情绪识别Web应用系统，能够识别7种基本情绪：**高兴、悲伤、惊讶、恐惧、愤怒、厌恶、中性**

基于RAF-DB数据集训练的人脸情绪识别系统，支持多种深度学习模型，提供完整的前后端实现。

### 🎯 核心特性

完整的人脸情绪识别系统，识别7种基本情绪：**高兴、悲伤、惊讶、恐惧、愤怒、厌恶、中性**

- 🤖 **多模型支持** - CNN (83.77%)、VGG16 (80%)、SE-Net-81、SE-Net-83 四种模型

- 📸 **灵活输入** - 图片上传 + 实时摄像头拍照</div>

- 🔍 **智能检测** - 自动人脸检测 + 图像质量评估

- 💊 **心理健康** - 210条专业建议（每种情绪30条）### 🎯 核心特性

- 📊 **数据分析** - ECharts可视化 + 历史记录统计

- 👤 **用户中心** - 个人资料管理 + 偏好设置---

- 🌐 **现代化UI** - 响应式设计 + 多页面导航

- 🤖 **4种深度学习模型**: CNN (83.77%)、VGG16 (80%)、SE-Net-81、SE-Net-83

### 🛠️ 技术栈

- 📸 **灵活输入**: 图片上传 + 摄像头拍照## 📋 项目概述

**后端**: Python 3.8 • Flask 2.3.0 • TensorFlow 2.x • MTCNN • OpenCV  

**前端**: Vue 3 • Vite • Element Plus • ECharts 5.4.3 • Pinia • Vue Router- 🔍 **智能检测**: 自动人脸检测 + 图像质量评估



---- 💊 **心理健康**: 210条专业建议（每种情绪30条）这是一个完整的人脸情绪识别Web应用系统，能够识别7种基本情绪：高兴、悲伤、惊讶、恐惧、愤怒、厌恶、中性。



## 🚀 快速开始- 📊 **数据分析**: ECharts可视化 + 历史记录统计



### 前置要求- 👤 **用户中心**: 个人资料 + 偏好设置### 核心特性



- Python 3.8-3.10- 🌐 **现代化UI**: 响应式设计 + 多页面导航

- Node.js 16+

- npm 或 yarn- 🎯 **多模型支持**: CNN (83.77%)、VGG16 (80%)、SE-Net-81、SE-Net-83 四种模型可选

- (推荐) Conda 环境管理

### 🛠️ 技术栈- 📸 **灵活输入**: 支持图片上传和实时摄像头拍照

### 方法一：一键启动（Windows）

- 🔍 **智能检测**: 自动人脸检测和图像质量评估

```bash

# 首次安装依赖**后端**: Python 3.8 • Flask 2.3.0 • TensorFlow 2.x • MTCNN • OpenCV  - 💊 **心理健康**: 210条专业建议，每种情绪30条分类建议

install.bat

**前端**: Vue 3 • Vite • Element Plus • ECharts 5.4.3 • Pinia • Vue Router- 📊 **数据分析**: ECharts可视化图表，历史记录统计

# 启动服务（需打开两个终端窗口）

start_backend.bat   # 终端1：启动后端- 👤 **用户中心**: 个人资料管理、偏好设置

start_frontend.bat  # 终端2：启动前端

---- 🌐 **现代化UI**: 响应式设计，多页面导航系统

# 访问 http://localhost:5173

```



### 方法二：手动启动## 🚀 快速开始### 技术栈



#### 1️⃣ 后端部署



```bash### 方法一：一键启动（Windows推荐）**后端**

# 创建虚拟环境

conda create -n FER python=3.8- Python 3.8 + Flask 2.3.0

conda activate FER

```bash- TensorFlow 2.x / Keras

# 安装依赖

cd backend# 首次安装依赖- MTCNN (人脸检测)

pip install -r requirements.txt

install.bat- SQLite (可选数据库)

# 启动服务（首次会预热模型，需30-60秒）

python app.py- OpenCV (图像处理)

# 后端运行在 http://localhost:5000

```# 启动服务（打开两个终端窗口）



#### 2️⃣ 前端部署start_backend.bat   # 终端1：启动后端**前端**



```bashstart_frontend.bat  # 终端2：启动前端- Vue 3 + Vite

# 安装依赖

cd frontend- Element Plus UI框架

npm install

# 访问 http://localhost:5173- ECharts 5.4.3 (数据可视化)

# 启动开发服务器

npm run dev```- Pinia (状态管理)

# 前端运行在 http://localhost:5173

```- Vue Router (路由)



---### 方法二：手动启动



## 📖 使用指南### 功能特性



### 🎭 情绪识别（主页）#### 1️⃣ 启动后端- ✅ 支持4种深度学习模型 (CNN, VGG16, SE-81, SE-83)



1. 上传图片 或 使用摄像头拍照- ✅ 实时人脸检测

2. 选择模型（CNN/VGG16/SE-81/SE-83）

3. 点击"开始识别"```bash- ✅ 图片上传/摄像头拍照

4. 查看识别结果和概率分布

# 创建虚拟环境- ✅ 详细情绪概率分布

### 💊 心理健康中心

conda create -n FER python=3.8- ✅ 识别历史记录

- 浏览210条专业建议（7种情绪 × 30条）

- 按情绪分类查看conda activate FER- ✅ 响应式UI设计

- 点击"换一批"刷新建议

- 查看放松技巧和心理资源



### 📊 数据分析# 安装依赖## 🚀 快速开始



- 情绪分布饼图cd backend

- 趋势变化折线图

- 模型性能对比pip install -r requirements.txt### 前置要求

- 历史记录表格

- 导出CSV数据- Python 3.8-3.10



### 🤖 模型选择建议# 启动服务（首次会预热模型30-60秒）- Node.js 16+



| 模型 | 准确率 | 速度 | 推理时间 | 适用场景 |python app.py- npm 或 yarn

|------|-------|------|----------|---------|

| **CNN** | 83.77% | 快 | ~50ms | 实时应用，资源受限 ⭐ |# 后端运行在 http://localhost:5000

| **VGG16** | 80% | 中 | ~80ms | 平衡性能和准确率 |

| **SE-Net-81** | 81% | 慢 | ~100ms | 高准确率要求 |```### 1️⃣ 后端部署

| **SE-Net-83** | 83%+ | 慢 | ~100ms | 最佳准确率 ⭐⭐ |



---

#### 2️⃣ 启动前端#### 安装依赖

## 📂 项目结构

```bash

```

RAF-DB_model/```bashcd backend

├── backend/                    # 后端服务

│   ├── app.py                 # Flask主应用 ⭐# 安装依赖pip install -r requirements.txt

│   ├── config.py              # 配置文件

│   ├── database.py            # 数据库模块cd frontend```

│   ├── face_quality.py        # 图像质量评估

│   └── requirements.txt       # Python依赖npm install

│

├── frontend/                   # 前端应用#### 配置模型路径

│   └── src/

│       ├── views/             # 页面组件# 启动开发服务器检查 `config.py` 中的模型路径是否正确:

│       │   ├── Home.vue      # 情绪识别 ⭐

│       │   ├── Health.vue    # 心理健康 ⭐npm run dev```python

│       │   ├── Analysis.vue  # 数据分析

│       │   ├── User.vue      # 用户中心# 前端运行在 http://localhost:5173MODEL_CONFIG = {

│       │   ├── History.vue   # 历史记录

│       │   └── About.vue     # 关于页面```    'cnn': {

│       ├── data/

│       │   └── adviceLibrary.js  # 210条建议 ⭐        'path': MODEL_DIR / 'RAF_CNN_83_best_model.h5',

│       ├── stores/emotion.js     # 状态管理

│       └── utils/api.js          # API封装---    }

│

├── models/                     # 训练模型 ⭐⭐⭐}

│   ├── RAF_CNN_83_best_model.h5

│   ├── RAF_VGG_80_best_model.h5## 📖 使用指南```

│   ├── RAF_SE_81_saved_model/

│   └── RAF_SE_83_saved_model/

│

├── RAF_CNN.ipynb              # CNN训练笔记本### 🎭 情绪识别（主页）#### 启动后端服务

├── RAF_VGG.ipynb              # VGG训练笔记本

├── RAF_SE.ipynb               # SE-Net训练笔记本1. 上传图片 或 使用摄像头拍照```bash

│

├── README.md                   # 项目主文档 📄2. 选择模型（CNN/VGG16/SE-81/SE-83）python app.py

├── DEVELOPMENT.md              # 开发文档 📄

├── TROUBLESHOOTING.md          # 故障排除 📄3. 点击"开始识别"```

└── CHANGELOG.md                # 更新日志 📄

```4. 查看识别结果和概率分布



---服务将在 `http://localhost:5000` 启动



## 🔌 API接口### 💊 心理健康中心



### 健康检查- 浏览210条专业建议（7种情绪 × 30条）### 2️⃣ 前端部署



```http- 按情绪分类查看

GET /api/health

```- 点击"换一批"刷新建议#### 安装依赖



**响应**:- 查看放松技巧和心理资源```bash

```json

{cd frontend

  "status": "ok",

  "available_models": ["cnn", "vgg", "se81", "se83"]### 📊 数据分析npm install

}

```- 情绪分布饼图```



### 情绪预测- 趋势变化折线图



```http- 模型性能对比#### 启动开发服务器

POST /api/predict

Content-Type: multipart/form-data- 历史记录表格```bash

```

- 导出CSV数据npm run dev

**参数**:

- `image`: 图片文件（JPEG/PNG）```

- `model`: cnn | vgg | se81 | se83

### 👤 用户中心

**响应**:

```json- 管理个人资料前端将在 `http://localhost:3000` 启动

{

  "success": true,- 偏好设置（主题、通知）

  "emotion": "高兴",

  "confidence": 0.8532,- 隐私设置#### 构建生产版本

  "probabilities": {...},

  "face_detected": true,- 账户安全```bash

  "processing_time": 0.234

}npm run build

```

### 🤖 模型选择建议```

更多API详情 → [backend/README.md](backend/README.md) 或 [DEVELOPMENT.md](DEVELOPMENT.md)



---

| 模型 | 准确率 | 速度 | 推理时间 | 适用场景 |## 🔧 重要配置说明

## 📊 模型性能

|------|-------|------|----------|---------|

### RAF-DB数据集

| **CNN** | 83.77% | 快 | ~50ms | 实时应用，资源受限 ⭐ |### 后端配置 (backend/config.py)

- **训练集**: 12,271张图片

- **测试集**: 3,068张图片| **VGG16** | 80% | 中 | ~80ms | 平衡性能和准确率 |

- **类别数**: 7种情绪

- **图像尺寸**: 100×100px| **SE-Net-81** | 81% | 慢 | ~100ms | 高准确率要求 |```python



### 性能对比| **SE-Net-83** | 83%+ | 慢 | ~100ms | 最佳准确率 ⭐⭐ |# 服务器配置



| 模型 | 准确率 | 参数量 | 训练时间 | 推理速度 | 内存占用 |HOST = '0.0.0.0'

|------|-------|--------|----------|---------|----------|

| CNN | 83.77% | ~5M | 2-3h | ~50ms | ~200MB |---PORT = 5000

| VGG16 | 80% | ~15M | 4-5h | ~80ms | ~500MB |

| SE-Net-81 | 81% | ~8M | 5-6h | ~100ms | ~300MB |DEBUG = True  # 生产环境改为False

| SE-Net-83 | 83%+ | ~8M | 5-6h | ~100ms | ~300MB |

## 📂 项目结构

详细分析 → [DEVELOPMENT.md](DEVELOPMENT.md)

# 模型配置

---

```MODEL_CONFIG = {

## ❓ 常见问题

RAF-DB_model/    'cnn': {

### 1. 后端启动失败

├── backend/                    # 后端服务        'path': MODEL_DIR / 'RAF_CNN_83_best_model.h5',

**错误**: `ModuleNotFoundError`

│   ├── app.py                 # Flask主应用 ⭐        'input_shape': (100, 100, 3),

**解决**:

```bash│   ├── config.py              # 配置文件    }

cd backend

pip install -r requirements.txt│   ├── database.py            # 数据库模块}

```

│   ├── face_quality.py        # 图像质量评估

### 2. 前端连接失败 (ECONNREFUSED)

│   └── requirements.txt       # Python依赖# 上传配置

**原因**: 后端未启动或端口被占用

│MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

**解决**:

```bash├── frontend/                   # 前端应用```

# 检查后端是否运行

curl http://localhost:5000/api/health│   └── src/



# Windows检查端口│       ├── views/             # 页面组件### 前端配置 (frontend/vite.config.js)

netstat -ano | findstr :5000

│       │   ├── Home.vue      # 情绪识别 ⭐

# 重启后端

cd backend && python app.py│       │   ├── Health.vue    # 心理健康 ⭐```javascript

```

│       │   ├── Analysis.vue  # 数据分析server: {

### 3. 模型加载错误

│       │   ├── User.vue      # 用户中心  port: 3000,

**解决**: 确认模型文件存在

```bash│       │   ├── History.vue   # 历史记录  proxy: {

# Windows

dir models\*.h5│       │   └── About.vue     # 关于    '/api': {



# Linux/Mac│       ├── data/      target: 'http://localhost:5000',

ls models/*.h5

```│       │   └── adviceLibrary.js  # 210条建议 ⭐      changeOrigin: true



### 4. 图片识别失败│       ├── stores/emotion.js     # 状态管理    }



**要求**:│       └── utils/api.js          # API封装  }

- 包含清晰正面人脸

- 光线充足│}

- 人脸占比 > 30%

- 避免多人脸或侧脸├── models/                     # 训练模型 ⭐⭐⭐```



### 5. 识别速度慢│   ├── RAF_CNN_83_best_model.h5



**优化**:│   ├── RAF_VGG_80_best_model.h5## 📊 API接口文档

- 使用CNN模型（最快）

- 压缩图片（< 800px）│   ├── RAF_SE_81_saved_model/

- 启用GPU加速

- 系统已内置模型预热│   └── RAF_SE_83_saved_model/### 1. 健康检查



更多问题 → [TROUBLESHOOTING.md](TROUBLESHOOTING.md)│```



---├── RAF_CNN.ipynb              # CNN训练笔记本GET /api/health



## 📝 版本历史├── RAF_VGG.ipynb              # VGG训练笔记本```



### v2.0.0 (2025-10-16) 🎉├── RAF_SE.ipynb               # SE-Net训练笔记本



- ✨ 新增多页面导航系统（6个页面）│### 2. 情绪识别

- ✨ 新增心理健康中心（210条专业建议）

- ✨ 新增数据分析仪表板（ECharts可视化）├── README.md                   # 项目文档 📄```

- ✨ 新增用户中心功能

- 🔧 修复SE模型预处理问题├── DEVELOPMENT.md              # 开发文档 📄POST /api/predict

- ⚡ 优化模型预热机制

- ⚡ 新增图像质量评估模块├── TROUBLESHOOTING.md          # 故障排除 📄Content-Type: application/json

- 🎨 全面改进UI/UX

└── CHANGELOG.md                # 更新日志 📄

### v1.0.0

```{

- ✅ 基础情绪识别功能

- ✅ CNN、VGG16模型支持  "image": "base64编码的图片",

- ✅ Web界面和历史记录

---  "model": "cnn|vgg|se",

完整日志 → [CHANGELOG.md](CHANGELOG.md)

  "detect_face": true

---

## 🔌 API接口}

## 🛠️ 开发相关

```

### 训练新模型

### 健康检查

```bash

jupyter notebook RAF_CNN.ipynb```http### 3. 批量识别

```

GET /api/health```

### 运行测试

```POST /api/batch_predict

```bash

cd backend响应：Content-Type: application/json

python test_api.py

python test_se_model.py```json

```

{{

### 修改配置

  "status": "ok",  "images": ["base64_1", "base64_2"],

编辑 `backend/config.py`:

```python  "available_models": ["cnn", "vgg", "se81", "se83"]  "model": "cnn",

MODEL_CONFIG = {...}

HOST = '0.0.0.0'}  "detect_face": true

PORT = 5000

DEBUG = True  # 生产环境设为False```}

```

```

更多开发信息 → [DEVELOPMENT.md](DEVELOPMENT.md)

### 情绪预测

---

```http详细API文档请查看 `backend/README.md`

## 📄 文档导航

POST /api/predict

- **[README.md](README.md)** - 项目介绍和快速开始（当前文档）

- **[DEVELOPMENT.md](DEVELOPMENT.md)** - 开发文档、架构说明、模型详情Content-Type: multipart/form-data## ⚠️ 重要注意事项

- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - 故障排除和常见问题解决

- **[CHANGELOG.md](CHANGELOG.md)** - 完整版本更新日志

- **[DOCS_GUIDE.md](DOCS_GUIDE.md)** - 文档导航和快速查找

参数:### 1. Python版本兼容性

---

- image: 图片文件（JPEG/PNG）- **强烈建议**: 使用与训练时相同的Python版本(3.8)

## 🔐 安全建议

- model: cnn | vgg | se81 | se83- **原因**: TensorFlow和Keras的版本兼容性

**生产环境**:

- 设置 `DEBUG = False````- **可接受范围**: Python 3.8-3.10

- 使用环境变量存储敏感信息

- 启用HTTPS响应：



**认证和限制**:```json### 2. TensorFlow版本

- 添加API认证（JWT/API Key）

- 请求频率限制（Flask-Limiter）{```bash

- 文件大小限制（已配置16MB）

  "success": true,# 检查训练时使用的版本

**数据隐私**:

- 不保存用户上传图片  "emotion": "高兴",python -c "import tensorflow as tf; print(tf.__version__)"

- 定期清理临时文件

- 数据库加密（如启用）  "confidence": 0.8532,



---  "probabilities": {...},# 如果版本不一致,安装相同版本



## 👥 贡献指南  "face_detected": true,pip install tensorflow==2.13.0



欢迎提交Issue和Pull Request！  "processing_time": 0.234```



**贡献流程**:}

1. Fork本项目

2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)```### 3. SE模型说明

3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)

4. 推送到分支 (`git push origin feature/AmazingFeature`)✅ **好消息**: SE模型已经以SavedModel格式保存!

5. 开启Pull Request

更多API详情 → `backend/README.md` 或 `DEVELOPMENT.md`- `RAF_SE_81_saved_model/` - 包含完整模型结构和权重 (81%)

**代码规范**: Python PEP 8 | JavaScript ESLint

- `RAF_SE_83_saved_model/` - 包含完整模型结构和权重 (83%)

---

---- 可以直接加载使用,无需额外配置

## 🙏 致谢



- **RAF-DB数据集** 提供者

- **TensorFlow / Keras** 团队## 📊 模型性能测试SE模型:

- **Vue.js / Element Plus** 社区

- **MTCNN** 人脸检测库```bash

- **ECharts** 可视化库

### RAF-DB数据集cd backend

---

- **训练集**: 12,271张 | **测试集**: 3,068张python test_se_model.py

<div align="center">

- **类别数**: 7种情绪 | **图像**: 100×100px```

**⭐ 如果这个项目对你有帮助，请给一个Star！⭐**



Made with ❤️ for Emotion Recognition

### 性能对比### 4. 数据库(可选)

[⬆ 回到顶部](#人脸情绪识别系统)



</div>

| 模型 | 准确率 | 参数量 | 训练时间 | 推理速度 | 内存占用 |#### 不需要数据库的场景:

|------|-------|--------|----------|---------|----------|- 只做实时识别

| CNN | 83.77% | ~5M | 2-3h | ~50ms | ~200MB |- 演示/测试系统

| VGG16 | 80% | ~15M | 4-5h | ~80ms | ~500MB |

| SE-Net-81 | 81% | ~8M | 5-6h | ~100ms | ~300MB |#### 需要数据库的场景:

| SE-Net-83 | 83%+ | ~8M | 5-6h | ~100ms | ~300MB |- 保存识别历史

- 用户管理

详细分析 → `DEVELOPMENT.md`- 统计分析



---#### 启用数据库:

1. 取消注释 `backend/requirements.txt` 中的数据库依赖

## ❓ 常见问题2. 在 `backend/app.py` 中添加数据库初始化代码

3. 参考 `backend/database.py` 中的示例

### 1. 后端启动失败

```bash## 🌐 生产环境部署

# 错误: ModuleNotFoundError

# 解决:### 后端部署 (使用Gunicorn)

pip install -r backend/requirements.txt

``````bash

# 安装Gunicorn

### 2. 前端连接失败 (ECONNREFUSED)pip install gunicorn

```bash

# 检查后端是否运行# 启动服务(4个工作进程)

curl http://localhost:5000/api/healthgunicorn -w 4 -b 0.0.0.0:5000 app:app



# Windows检查端口# 后台运行

netstat -ano | findstr :5000nohup gunicorn -w 4 -b 0.0.0.0:5000 app:app > gunicorn.log 2>&1 &

```

# 重启后端

cd backend && python app.py### 前端部署 (使用Nginx)

```

```bash

### 3. 模型加载错误# 构建前端

```bashcd frontend

# 检查模型文件是否存在npm run build

dir models\*.h5  # Windows

ls models/*.h5   # Linux/Mac# 将 dist 目录部署到Nginx

```# nginx.conf 示例:

server {

### 4. 图片识别失败    listen 80;

- 确保图片包含清晰正面人脸    server_name your-domain.com;

- 光线充足，避免过暗/过曝    

- 人脸占比>30%    root /path/to/frontend/dist;

- 避免多人脸或侧脸    index index.html;

    

### 5. 识别速度慢    location / {

- 使用CNN模型（最快）        try_files $uri $uri/ /index.html;

- 启用GPU加速    }

- 调整图片大小（<800px）    

- 已内置模型预热机制    location /api/ {

        proxy_pass http://localhost:5000/api/;

更多问题 → `TROUBLESHOOTING.md`        proxy_set_header Host $host;

        proxy_set_header X-Real-IP $remote_addr;

---    }

}

## 📝 版本历史```



### v2.0.0 (2025-10-16) 🎉### 使用Docker部署

- ✨ 多页面导航系统（6个页面）

- ✨ 心理健康中心（210条建议）后端Dockerfile示例:

- ✨ 数据分析仪表板（ECharts）```dockerfile

- ✨ 用户中心功能FROM python:3.8-slim

- 🔧 修复SE模型预处理

- ⚡ 模型预热机制WORKDIR /app

- ⚡ 图像质量评估COPY backend/ .

- 🎨 UI/UX全面改进COPY models/ ../models/



### v1.0.0 (初始版本)RUN pip install -r requirements.txt

- ✅ 基础情绪识别

- ✅ CNN、VGG16模型EXPOSE 5000

- ✅ Web界面CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]

- ✅ 历史记录```



完整日志 → `CHANGELOG.md`## 🐛 常见问题解决



---### 1. 模型加载失败

```

## 🛠️ 开发相关错误: Unable to load model

解决: 

### 训练新模型- 检查模型文件路径

```bash- 确认TensorFlow版本一致

jupyter notebook RAF_CNN.ipynb- 检查模型文件是否损坏

``````



### 运行测试### 2. 跨域问题

```bash```

cd backend错误: CORS policy blocked

python test_api.py解决: 

python test_se_model.py- 确认 flask-cors 已安装

```- 检查 CORS(app) 是否配置

- 前端使用代理配置

### 修改配置```

编辑 `backend/config.py`:

```python### 3. 图片上传失败

MODEL_CONFIG = {...}```

HOST = '0.0.0.0'错误: Request Entity Too Large

PORT = 5000解决: 

DEBUG = True  # 生产环境设为False- 检查 MAX_CONTENT_LENGTH 配置

```- 压缩图片大小

- 增加服务器限制

更多开发信息 → `DEVELOPMENT.md````



---### 4. 摄像头无法访问

```

## 📄 文档导航错误: Cannot access camera

解决: 

- **README.md** - 项目介绍和快速开始 ← 你在这里- 使用 HTTPS 或 localhost

- **DEVELOPMENT.md** - 开发文档、架构、模型详情- 检查浏览器权限

- **TROUBLESHOOTING.md** - 故障排除和常见问题- 确认摄像头未被占用

- **CHANGELOG.md** - 完整版本更新日志```



---## 📈 性能优化建议



## 🔐 安全建议### 后端优化

1. 预加载模型(避免首次请求慢)

- 生产环境设置 `DEBUG = False`2. 使用GPU加速(如果可用)

- 使用环境变量存储敏感信息3. 添加缓存机制

- 启用HTTPS4. 使用异步处理

- 添加API认证（JWT/API Key）

- 请求频率限制### 前端优化

- 不保存用户上传图片1. 图片压缩后再上传

2. 使用CDN加载静态资源

---3. 启用Gzip压缩

4. 懒加载组件

## 👥 贡献

## 🔐 安全建议

欢迎提交Issue和Pull Request！

1. **生产环境**:

1. Fork项目   - 设置 `DEBUG = False`

2. 创建特性分支 (`feature/AmazingFeature`)   - 使用环境变量存储敏感信息

3. 提交更改   - 启用HTTPS

4. 推送并开启PR

2. **添加认证**:

代码规范：Python PEP 8 | JavaScript ESLint   - API Key验证

   - JWT Token

---   - 用户登录系统



## 🙏 致谢3. **请求限制**:

   - 添加频率限制(Flask-Limiter)

RAF-DB数据集 • TensorFlow/Keras • Vue.js • Element Plus • MTCNN • ECharts   - 文件大小限制

   - 并发控制

---

4. **数据安全**:

<div align="center">   - 不保存用户上传的敏感图片

   - 定期清理临时文件

**⭐ 如果有帮助，请给个Star！⭐**   - 数据库加密



Made with ❤️ for Emotion Recognition## 📞 需要帮助?



</div>如果遇到问题:

1. 查看 `backend/logs/app.log` 日志
2. 检查浏览器控制台错误
3. 确认前后端都已正常启动
4. 检查网络连接和防火墙设置

## 📝 下一步计划

- [ ] 添加更多模型支持
- [ ] 实现实时视频流识别
- [ ] 添加用户管理系统
- [ ] 情绪统计和可视化
- [ ] 移动端APP开发
- [ ] 模型解释性分析

## 🎉 开始使用

1. 启动后端: `cd backend && python app.py`
2. 启动前端: `cd frontend && npm run dev`
3. 访问: `http://localhost:3000`
4. 上传图片或使用摄像头
5. 查看识别结果!

---

**祝你使用愉快! 🚀**


