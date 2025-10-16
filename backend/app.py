"""
人脸情绪识别系统 - Flask后端API
支持三种模型: CNN, VGG16, SE-Net
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
from tensorflow import keras
import numpy as np
import cv2
import base64
from PIL import Image
import io
import os
from datetime import datetime
from image_preprocess import (
    preprocess_for_model,
    infer_input_shape_from_keras,
    infer_input_shape_from_saved_model,
    detect_and_align_mtcnn,
    enhance_clarity,
)
from face_quality import assess_face_quality, get_quality_level
import logging
import time
from functools import wraps

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 情绪类别标签
EMOTION_LABELS = ['anger', 'disgust', 'fear', 'happy', 'normal', 'sad', 'surprised']
EMOTION_LABELS_CN = ['生气', '厌恶', '害怕', '高兴', '平静', '悲伤', '惊讶']

# 模型路径配置
MODEL_PATHS = {
    'cnn': '../models/RAF_CNN_83_best_model.h5',
    'vgg': '../models/RAF_VGG_80_best_model.h5',
    'se81': '../models/RAF_SE_81_saved_model',
    'se83': '../models/RAF_SE_83_saved_model'
}

# 全局变量存储已加载的模型
models = {}

# 性能监控装饰器
def timing_decorator(operation_name):
    """性能监控装饰器"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            start = time.time()
            result = f(*args, **kwargs)
            duration = time.time() - start
            logger.info(f"⏱️  {operation_name} 耗时: {duration:.3f}秒")
            return result
        return wrapper
    return decorator

def _wrap_saved_model(loaded):
    """将 tf.saved_model.load 返回对象包装为统一结构。"""
    infer = None
    if hasattr(loaded, 'signatures') and 'serving_default' in loaded.signatures:
        infer = loaded.signatures['serving_default']
    input_shape = infer_input_shape_from_saved_model(loaded)
    return {
        'type': 'saved',
        'obj': loaded,
        'infer': infer,
        'input_shape': input_shape,
    }

def _wrap_keras_model(model):
    """将 Keras 模型包装为统一结构。"""
    input_shape = infer_input_shape_from_keras(model)
    return {
        'type': 'keras',
        'obj': model,
        'infer': None,
        'input_shape': input_shape,
    }

def load_model(model_name):
    """加载指定的模型，返回统一包装：{'type': 'keras'|'saved', 'obj': ..., 'infer': ..., 'input_shape': (H,W,C)}"""
    model_path = MODEL_PATHS.get(model_name)
    if not model_path or not os.path.exists(model_path):
        logger.error(f"模型文件不存在: {model_path}")
        return None

    # 1) 优先使用 Keras 加载（适用于 .h5 或包含 keras_metadata 的 SavedModel）
    try:
        model = keras.models.load_model(model_path)
        wrapper = _wrap_keras_model(model)
        logger.info(f"成功加载模型: {model_name} (Keras, from {model_path})")
        return wrapper
    except Exception as e:
        logger.warning(f"Keras 加载失败 {model_name}: {e}; 将尝试 tf.saved_model.load() 回退方式")

    # 2) 回退到 SavedModel 加载（适用于用 tf.saved_model.save 导出的目录）
    try:
        loaded = tf.saved_model.load(model_path)
        wrapper = _wrap_saved_model(loaded)
        logger.info(f"成功加载模型: {model_name} (SavedModel, from {model_path})")
        return wrapper
    except Exception as e2:
        logger.error(f"加载模型失败 {model_name}: {str(e2)}")
        return None

def run_inference(model_entry, x: np.ndarray) -> np.ndarray:
    """对包装后的模型进行推理，返回 numpy 数组预测结果。"""
    if model_entry is None:
        raise ValueError('模型未加载')
    if model_entry['type'] == 'keras':
        return model_entry['obj'].predict(x, verbose=0)
    # SavedModel
    infer = model_entry.get('infer')
    if infer is None:
        raise ValueError('SavedModel 缺少 serving_default 签名，无法推理')
    input_key = list(infer.structured_input_signature[1].keys())[0]
    outputs = infer(**{input_key: tf.constant(x)})
    out_key = list(outputs.keys())[0]
    return outputs[out_key].numpy()


def _batch_array_to_data_url(arr: np.ndarray) -> str:
    """将形状为 (1,H,W,C) 且范围[0,1]的数组转为 data:image/jpeg;base64, 字符串。"""
    try:
        x = np.squeeze(arr, axis=0)
        if x.ndim == 2:
            img = Image.fromarray((x * 255.0).clip(0, 255).astype(np.uint8), mode='L')
        else:
            # 处理通道
            if x.shape[-1] == 1:
                img = Image.fromarray((x[..., 0] * 255.0).clip(0, 255).astype(np.uint8), mode='L')
            else:
                # 保留前三通道
                if x.shape[-1] > 3:
                    x = x[..., :3]
                # 若是 2 通道，填充为 3 通道
                if x.shape[-1] == 2:
                    pad = np.zeros((*x.shape[:2], 1), dtype=x.dtype)
                    x = np.concatenate([x, pad], axis=-1)
                img = Image.fromarray((x * 255.0).clip(0, 255).astype(np.uint8), mode='RGB')
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=90)
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        logger.warning(f"预处理图像可视化失败: {e}")
        return ''


def _pil_to_data_url(img: Image.Image) -> str:
    """将 PIL.Image 转为 data:image/jpeg;base64, 字符串。"""
    try:
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=90)
        b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        logger.warning(f"PIL 转 dataURL 失败: {e}")
        return ''

def preprocess_image(image_data, target_size=(100, 100)):
    """
    预处理图像
    Args:
        image_data: base64编码的图像或PIL Image对象
        target_size: 目标尺寸
    Returns:
        preprocessed_image: 预处理后的图像数组
    """
    try:
        # 如果是base64字符串,先解码
        if isinstance(image_data, str):
            # 移除data:image/jpeg;base64,前缀
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
        else:
            image = image_data
        
        # 旧函数保留，但此处仅做最基础RGB resize，具体到模型前会再次按模型输入形状处理
        image = image.convert('RGB').resize(target_size)
        arr = np.array(image).astype(np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)
        return arr
    except Exception as e:
        logger.error(f"图像预处理失败: {str(e)}")
        return None

def detect_face(image):
    """
    使用OpenCV检测人脸
    Args:
        image: PIL Image对象
    Returns:
        face_image: 检测到的人脸图像,如果没有检测到返回原图
    """
    try:
        # 转换为OpenCV格式
        img_array = np.array(image)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        # 加载人脸检测器
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        
        # 检测人脸
        faces = face_cascade.detectMultiScale(gray, 1.3, 5)
        
        if len(faces) > 0:
            # 取第一张人脸
            x, y, w, h = faces[0]
            face_img = img_array[y:y+h, x:x+w]
            return Image.fromarray(face_img)
        else:
            logger.warning("未检测到人脸,使用原图")
            return image
    except Exception as e:
        logger.error(f"人脸检测失败: {str(e)}")
        return image

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        'status': 'ok',
        'message': '服务运行正常',
        'available_models': list(MODEL_PATHS.keys())
    })

@app.route('/api/models', methods=['GET'])
def get_models():
    """获取可用的模型列表"""
    model_info = []
    for name, path in MODEL_PATHS.items():
        model_info.append({
            'name': name,
            'display_name': name.upper(),
            'available': os.path.exists(path),
            'path': path
        })
    return jsonify({'models': model_info})

@app.route('/api/predict', methods=['POST'])
def predict_emotion():
    """
    情绪识别接口
    请求格式:
    {
        "image": "base64编码的图像",
        "model": "cnn|vgg|se",
        "detect_face": true|false
    }
    """
    try:
        data = request.json
        
        if not data or 'image' not in data:
            return jsonify({'error': '缺少图像数据'}), 400
        
        # 获取模型类型
        model_name = data.get('model', 'cnn').lower()
        if model_name not in MODEL_PATHS:
            return jsonify({'error': f'不支持的模型: {model_name}'}), 400
        
        # 加载模型(如果还未加载)
        if model_name not in models:
            model_entry = load_model(model_name)
            if model_entry is None:
                return jsonify({'error': f'模型加载失败: {model_name}'}), 500
            models[model_name] = model_entry
        model_entry = models[model_name]
        
        # 解码图像
        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        original_image = image.copy()
        
        # 是否进行人脸检测与对齐：优先 MTCNN，对齐失败则回退 Haar
        if data.get('detect_face', True):
            aligned = detect_and_align_mtcnn(image)
            if aligned is not None:
                image = aligned
            else:
                image = detect_face(image)
        
        # 保存对齐后的人脸图用于展示
        aligned_face = image.copy()
        
        # 评估人脸质量
        quality_start = time.time()
        quality_result = assess_face_quality(aligned_face)
        quality_time = time.time() - quality_start
        logger.info(f"🔍 人脸质量评估: {quality_result['quality_score']:.1f}分 (耗时: {quality_time:.3f}秒)")
        
        # 如果质量过低,给出警告
        if not quality_result['is_acceptable']:
            logger.warning(f"⚠️  人脸质量较低: {', '.join(quality_result['warnings'])}")
        
        # 根据模型类型选择预处理模式
        if model_name == 'vgg':
            preprocess_mode = 'vgg'
        elif model_name in ('se81', 'se83'):
            preprocess_mode = 'efficientnet'
        else:
            preprocess_mode = 'simple'
        
        # 预处理图像（根据模型输入形状动态处理）
        preprocess_start = time.time()
        fallback = (96, 96, 1) if model_name in ("cnn",) else (100, 100, 3)
        processed_image = preprocess_for_model(
            image,
            model=model_entry['obj'] if model_entry['type'] == 'keras' else None,
            loaded=model_entry['obj'] if model_entry['type'] == 'saved' else None,
            fallback=model_entry.get('input_shape') or fallback,
            mode=preprocess_mode
        )
        if processed_image is None:
            return jsonify({'error': '图像预处理失败'}), 500
        preprocess_time = time.time() - preprocess_start
        logger.info(f"🔧 预处理完成 (模式: {preprocess_mode}, 耗时: {preprocess_time:.3f}秒)")

        # 进行预测（兼容 Keras 与 SavedModel）
        inference_start = time.time()
        predictions = run_inference(model_entry, processed_image)
        predicted_class = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class])
        inference_time = time.time() - inference_start
        logger.info(f"🤖 推理完成: {EMOTION_LABELS[predicted_class]} ({confidence:.2%}, 耗时: {inference_time:.3f}秒)")
        # 展示对齐后的人脸图（即模型实际预测的输入图）
        preproc_data_url = _pil_to_data_url(aligned_face)
        
        # 构建返回结果
        quality_level, quality_color = get_quality_level(quality_result['quality_score'])
        result = {
            'success': True,
            'emotion': EMOTION_LABELS[predicted_class],
            'emotion_cn': EMOTION_LABELS_CN[predicted_class],
            'confidence': confidence,
            'probabilities': {
                EMOTION_LABELS[i]: float(predictions[0][i])
                for i in range(len(EMOTION_LABELS))
            },
            'probabilities_cn': {
                EMOTION_LABELS_CN[i]: float(predictions[0][i])
                for i in range(len(EMOTION_LABELS))
            },
            'model_used': model_name.upper(),
            'timestamp': datetime.now().isoformat(),
            'preprocessed_image': preproc_data_url,
            # 新增: 人脸质量信息
            'face_quality': {
                'score': quality_result['quality_score'],
                'level': quality_level,
                'color': quality_color,
                'blur_score': quality_result['blur_score'],
                'brightness': quality_result['brightness'],
                'contrast': quality_result['contrast'],
                'warnings': quality_result['warnings'],
                'is_acceptable': quality_result['is_acceptable']
            },
            # 新增: 性能信息
            'performance': {
                'quality_assessment_time': round(quality_time, 3),
                'preprocessing_time': round(preprocess_time, 3),
                'inference_time': round(inference_time, 3),
                'total_time': round(quality_time + preprocess_time + inference_time, 3)
            }
        }
        
        logger.info(f"✅ 预测成功: {result['emotion_cn']} (置信度: {confidence:.2%}, 总耗时: {result['performance']['total_time']:.3f}秒)")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"预测失败: {str(e)}")
        return jsonify({'error': f'预测失败: {str(e)}'}), 500

@app.route('/api/batch_predict', methods=['POST'])
def batch_predict():
    """批量预测接口"""
    try:
        data = request.json
        
        if not data or 'images' not in data:
            return jsonify({'error': '缺少图像数据'}), 400
        
        images = data['images']
        model_name = data.get('model', 'cnn').lower()
        
        # 加载模型
        if model_name not in models:
            model_entry = load_model(model_name)
            if model_entry is None:
                return jsonify({'error': f'模型加载失败: {model_name}'}), 500
            models[model_name] = model_entry
        
        results = []
        for idx, img_data in enumerate(images):
            try:
                # 预处理
                if ',' in img_data:
                    img_data = img_data.split(',')[1]
                image_bytes = base64.b64decode(img_data)
                image = Image.open(io.BytesIO(image_bytes))
                original_image = image.copy()
                
                if data.get('detect_face', True):
                    aligned = detect_and_align_mtcnn(image)
                    if aligned is not None:
                        image = aligned
                    else:
                        image = detect_face(image)
                
                # 保存对齐后的人脸图用于展示
                aligned_face = image.copy()
                
                # 根据模型类型选择预处理模式
                if model_name == 'vgg':
                    preprocess_mode = 'vgg'
                elif model_name in ('se81', 'se83'):
                    preprocess_mode = 'efficientnet'
                else:
                    preprocess_mode = 'simple'
                
                model_entry = models[model_name]
                fallback = (96, 96, 1) if model_name in ("cnn",) else (100, 100, 3)
                processed_image = preprocess_for_model(
                    image,
                    model=model_entry['obj'] if model_entry['type'] == 'keras' else None,
                    loaded=model_entry['obj'] if model_entry['type'] == 'saved' else None,
                    fallback=model_entry.get('input_shape') or fallback,
                    mode=preprocess_mode
                )
                
                # 预测
                predictions = run_inference(models[model_name], processed_image)
                predicted_class = np.argmax(predictions[0])
                # 展示对齐后的人脸图（即模型实际预测的输入图）
                preproc_data_url = _pil_to_data_url(aligned_face)
                
                results.append({
                    'index': idx,
                    'emotion': EMOTION_LABELS[predicted_class],
                    'emotion_cn': EMOTION_LABELS_CN[predicted_class],
                    'confidence': float(predictions[0][predicted_class]),
                    'preprocessed_image': preproc_data_url
                })
            except Exception as e:
                results.append({
                    'index': idx,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'results': results,
            'model_used': model_name.upper()
        })
        
    except Exception as e:
        logger.error(f"批量预测失败: {str(e)}")
        return jsonify({'error': f'批量预测失败: {str(e)}'}), 500

def warmup_models():
    """启动时预热所有模型,加快首次请求响应"""
    logger.info("=" * 60)
    logger.info("🚀 开始模型预热...")
    logger.info("=" * 60)
    
    dummy_img = Image.new('RGB', (112, 112), (128, 128, 128))
    
    for model_name in MODEL_PATHS.keys():
        try:
            logger.info(f"⏳ 预热模型: {model_name.upper()}")
            start_time = time.time()
            
            # 加载模型
            model_entry = load_model(model_name)
            if model_entry is None:
                logger.warning(f"⚠️  模型 {model_name} 加载失败,跳过")
                continue
            
            models[model_name] = model_entry
            
            # 选择预处理模式
            if model_name == 'vgg':
                preprocess_mode = 'vgg'
            elif model_name in ('se81', 'se83'):
                preprocess_mode = 'efficientnet'
            else:
                preprocess_mode = 'simple'
            
            # 预处理
            fallback = (96, 96, 1) if model_name == 'cnn' else (100, 100, 3)
            processed = preprocess_for_model(
                dummy_img,
                model=model_entry['obj'] if model_entry['type'] == 'keras' else None,
                loaded=model_entry['obj'] if model_entry['type'] == 'saved' else None,
                fallback=fallback,
                mode=preprocess_mode
            )
            
            # 推理
            _ = run_inference(model_entry, processed)
            
            duration = time.time() - start_time
            logger.info(f"✅ 模型 {model_name.upper()} 预热完成 (耗时: {duration:.2f}秒)")
            
        except Exception as e:
            logger.error(f"❌ 模型 {model_name} 预热失败: {str(e)}")
    
    logger.info("=" * 60)
    logger.info(f"✅ 模型预热完成! 已加载 {len(models)}/{len(MODEL_PATHS)} 个模型")
    logger.info("=" * 60)


if __name__ == '__main__':
    logger.info("🚀 正在启动人脸情绪识别服务...")
    
    # 预热所有模型
    warmup_models()
    
    # 启动服务
    logger.info("🌐 服务启动在 http://0.0.0.0:5000")
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
