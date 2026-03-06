"""
打包脚本 - 使用 PyInstaller 生成可执行文件
"""
import subprocess
import sys
import os
import shutil

# 导入版本信息
from version import VERSION, VERSION_PARTS, COMPANY_NAME, FILE_DESCRIPTION, PRODUCT_NAME, COPYRIGHT


def generate_version_info():
    """根据 version.py 生成 Windows 版本信息文件"""
    version_content = f'''VSVersionInfo(
  ffi=FixedFileInfo(
    filevers={VERSION_PARTS},
    prodvers={VERSION_PARTS},
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo(
      [
      StringTable(
        '040904B0',
        [StringStruct('CompanyName', '{COMPANY_NAME}'),
        StringStruct('FileDescription', '{FILE_DESCRIPTION}'),
        StringStruct('FileVersion', '{VERSION}'),
        StringStruct('InternalName', 'PCStateMonitor'),
        StringStruct('LegalCopyright', '{COPYRIGHT}'),
        StringStruct('OriginalFilename', 'PCStateMonitor.exe'),
        StringStruct('ProductName', '{PRODUCT_NAME}'),
        StringStruct('ProductVersion', '{VERSION}')])
      ]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
'''
    # 确保 build 目录存在
    os.makedirs('build', exist_ok=True)
    version_file = os.path.join('build', 'version_info.txt')
    with open(version_file, 'w', encoding='utf-8') as f:
        f.write(version_content)
    print(f"已生成版本信息文件: {VERSION}")
    return version_file


def clean_build():
    """清理之前的构建文件"""
    dirs_to_remove = ['build', 'dist']
    for dir_name in dirs_to_remove:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"已删除: {dir_name}/")
    
    # 删除 spec 文件
    for file in os.listdir('.'):
        if file.endswith('.spec'):
            os.remove(file)
            print(f"已删除: {file}")


def build():
    """执行打包"""
    # 生成版本信息文件
    version_file = generate_version_info()
    
    # 确保依赖已安装
    try:
        import PyInstaller
    except ImportError:
        print("正在安装 PyInstaller...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'], check=True)
    
    # PyInstaller 参数
    args = [
        'pyinstaller',
        '--name=PCStateMonitor',
        '--onefile',           # 打包成单个 exe
        '--windowed',          # 不显示控制台窗口
        '--noconfirm',         # 覆盖输出目录不提示
        # 添加数据文件
        '--add-data=public;public',
        # 隐藏导入（pywin32 需要）
        '--hidden-import=win32api',
        '--hidden-import=win32gui',
        '--hidden-import=win32con',
        '--hidden-import=winshell',
        '--hidden-import=win32com.client',
        # 图标
        '--icon=public/icon_active.ico',
        # 版本信息
        f'--version-file={version_file}',
        # 主程序
        'main.py'
    ]
    
    print("开始打包...")
    result = subprocess.run(args)
    
    if result.returncode == 0:
        print("\n打包成功!")
        print(f"输出目录: {os.path.abspath('dist')}")
        print(f"可执行文件: dist/PCStateMonitor.exe")
    else:
        print("\n打包失败!")
        sys.exit(1)


def create_release():
    """创建发布包"""
    release_dir = f'release/pcstate-{VERSION}'
    if os.path.exists(release_dir):
        shutil.rmtree(release_dir)
    
    os.makedirs(release_dir)
    
    # 复制 exe
    shutil.copy('dist/PCStateMonitor.exe', release_dir)
    
    # 复制 README
    if os.path.exists('README.md'):
        shutil.copy('README.md', release_dir)
    
    print(f"\n发布包已创建: {os.path.abspath(release_dir)}/")
    print("目录结构:")
    for root, dirs, files in os.walk(release_dir):
        level = root.replace(release_dir, '').count(os.sep)
        indent = '  ' * level
        print(f"{indent}{os.path.basename(root)}/")
        sub_indent = '  ' * (level + 1)
        for file in files:
            print(f"{sub_indent}{file}")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='打包 PCStateMonitor')
    parser.add_argument('--clean', action='store_true', help='清理构建文件')
    parser.add_argument('--release', action='store_true', help='创建发布包')
    args = parser.parse_args()
    
    if args.clean:
        clean_build()
    else:
        clean_build()
        build()
        if args.release:
            create_release()
