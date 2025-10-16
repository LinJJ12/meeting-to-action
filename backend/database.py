"""
数据库模块 (可选)
如果需要保存识别历史,可以使用此模块
"""

from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class PredictionHistory(db.Model):
    """预测历史表"""
    __tablename__ = 'prediction_history'
    
    id = db.Column(db.Integer, primary_key=True)
    emotion = db.Column(db.String(50), nullable=False)
    emotion_cn = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    model_used = db.Column(db.String(50), nullable=False)
    image_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'emotion': self.emotion,
            'emotion_cn': self.emotion_cn,
            'confidence': self.confidence,
            'model_used': self.model_used,
            'created_at': self.created_at.isoformat()
        }

class UserSession(db.Model):
    """用户会话表 (如果需要用户功能)"""
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_active = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db(app):
    """初始化数据库"""
    db.init_app(app)
    with app.app_context():
        db.create_all()
        print("数据库表创建成功!")

# 如果要在app.py中使用数据库,添加以下代码:
"""
from flask_sqlalchemy import SQLAlchemy
from database import db, PredictionHistory, init_db

# 在Flask app配置中添加:
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///emotion_recognition.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 初始化数据库
init_db(app)

# 在predict_emotion函数中保存记录:
history = PredictionHistory(
    emotion=result['emotion'],
    emotion_cn=result['emotion_cn'],
    confidence=confidence,
    model_used=model_name
)
db.session.add(history)
db.session.commit()

# 添加查询历史的接口:
@app.route('/api/history', methods=['GET'])
def get_history():
    limit = request.args.get('limit', 50, type=int)
    histories = PredictionHistory.query.order_by(
        PredictionHistory.created_at.desc()
    ).limit(limit).all()
    return jsonify({
        'histories': [h.to_dict() for h in histories]
    })
"""
