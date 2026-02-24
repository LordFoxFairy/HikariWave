import os
import sys
import torch
from pathlib import Path
from huggingface_hub import snapshot_download

# --- 1. 路径挂载 ---
current_dir = Path(__file__).parent.absolute()
# 关键：挂载 ACE_Step 的根目录
ace_repo_path = current_dir / "backend" / "components" / "ACE_Step"
sys.path.append(str(ace_repo_path))

# --- 2. 导入它真正的类 ---
try:
    # 根据 ls 结果，它的 pipeline 在 acestep/pipeline_ace_step.py
    from acestep.pipeline_ace_step import ACEStepPipeline

    print("✅ 成功导入 ACEStepPipeline")
except ImportError as e:
    print(f"❌ 导入失败，请检查 PYTHONPATH。错误: {e}")
    sys.exit(1)


def validate_model():
    model_id = "ACE-Step/Ace-Step1.5"
    sub_folder = "acestep-v15-turbo"

    try:
        # 3. 定位权重文件
        print("🔍 正在定位权重...")
        repo_cache_path = snapshot_download(repo_id=model_id, allow_patterns=[f"{sub_folder}/*"])
        full_load_path = os.path.join(repo_cache_path, sub_folder)

        # 4. 初始化 Pipeline (这才是它正确的启动方式)
        print(f"🚀 正在加载 Pipeline 自: {full_load_path}")

        # 这个模型通常需要从本地文件夹加载，由于我们已经下载到了 snapshots，直接传路径
        pipe = ACEStepPipeline.from_pretrained(
            full_load_path,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            # trust_remote_code 在这里可能不需要，因为代码已经在本地了
        )

        if torch.cuda.is_available():
            pipe.to("cuda")

        print("✨ [验证成功] ACEStepPipeline 已成功初始化！")

        # 提示：这个模型是用来生成音乐/音频的，通常用法如下：
        # output = pipe(prompt="一段快节奏的电子乐", audio=reference_audio)

    except Exception as e:
        print(f"❌ 运行报错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    validate_model()