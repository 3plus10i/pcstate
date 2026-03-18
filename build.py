"""
打包脚本 - 使用 PyInstaller/Nuitka 生成可执行文件
"""
import subprocess
import sys
import os
import shutil

from version import VERSION, VERSION_PARTS, COMPANY_NAME, FILE_DESCRIPTION, PRODUCT_NAME, COPYRIGHT

# ========== 构建开关 ==========
# 实测不如直接pyinstaller
NUITKA = False  # True: 使用Nuitka编译, False: 使用PyInstaller打包


def generate_version_info():
    """生成 Windows 版本信息文件"""
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
    StringFileInfo([
      StringTable('040904B0', [
        StringStruct('CompanyName', '{COMPANY_NAME}'),
        StringStruct('FileDescription', '{FILE_DESCRIPTION}'),
        StringStruct('FileVersion', '{VERSION}'),
        StringStruct('InternalName', 'PCStateMonitor'),
        StringStruct('LegalCopyright', '{COPYRIGHT}'),
        StringStruct('OriginalFilename', 'PCStateMonitor.exe'),
        StringStruct('ProductName', '{PRODUCT_NAME}'),
        StringStruct('ProductVersion', '{VERSION}')
      ])
    ]),
    VarFileInfo([VarStruct('Translation', [1033, 1200])])
  ]
)
'''
    os.makedirs('build', exist_ok=True)
    version_file = os.path.join('build', 'version_info.txt')
    with open(version_file, 'w', encoding='utf-8') as f:
        f.write(version_content)
    print(f"已生成版本信息: {VERSION}")
    return version_file


def sync_frontend_version():
    """同步前端版本号 (从 version.py)"""
    import json
    
    frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')
    package_json = os.path.join(frontend_dir, 'package.json')
    
    # 将 4 段版本号转为 3 段 (1.4.0.0 -> 1.4.0)
    frontend_version = '.'.join(VERSION.split('.')[:3])
    
    with open(package_json, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if data.get('version') != frontend_version:
        data['version'] = frontend_version
        with open(package_json, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f"已同步前端版本: {frontend_version}")
    else:
        print(f"前端版本已是最新: {frontend_version}")


def build_frontend():
    """构建前端"""
    frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')

    if not os.path.exists(os.path.join(frontend_dir, 'node_modules')):
        print("安装前端依赖...")
        subprocess.run(['npm', 'install'], cwd=frontend_dir, shell=True, check=True)

    # 同步版本号
    sync_frontend_version()

    print("构建前端...")
    result = subprocess.run(['npm', 'run', 'build'], cwd=frontend_dir, shell=True)

    if result.returncode == 0:
        print("前端构建完成 → viewer/")
    else:
        print("前端构建失败，继续打包...")


def clean_build():
    """清理构建文件"""
    dirs_to_clean = ['build', 'dist']
    if NUITKA:
        dirs_to_clean.append('nuitka')
    
    for dir_name in dirs_to_clean:
        if os.path.exists(dir_name):
            shutil.rmtree(dir_name)
            print(f"已删除: {dir_name}/")

    for file in os.listdir('.'):
        if file.endswith('.spec'):
            os.remove(file)
            print(f"已删除: {file}")


def build_exe():
    """打包可执行文件 (PyInstaller)"""
    version_file = generate_version_info()

    try:
        import PyInstaller
    except ImportError:
        print("安装 PyInstaller...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'], check=True)

    args = [
        'pyinstaller',
        '--name=PCStateMonitor',
        '--onefile',
        '--windowed',
        '--noconfirm',
        '--add-data=viewer;viewer',   # 前端构建产物
        '--add-data=public;public',   # 图标等静态资源
        '--add-data=src;src',
        '--hidden-import=win32api',
        '--hidden-import=win32gui',
        '--hidden-import=win32con',
        '--hidden-import=winshell',
        '--hidden-import=win32com.client',
        '--hidden-import=win11toast',
        '--icon=public/icon_active.ico',
        f'--version-file={version_file}',
        'src/main.py'
    ]

    print("开始打包...")
    result = subprocess.run(args)

    if result.returncode == 0:
        print(f"\n打包成功! 输出: dist/PCStateMonitor.exe")
    else:
        print("\n打包失败!")
        sys.exit(1)


def build_exe_nuitka():
    """编译可执行文件 (Nuitka)"""
    try:
        import nuitka
    except ImportError:
        print("安装 Nuitka...")
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'nuitka'], check=True)

    print("Nuitka编译中... (首次编译可能需要5-10分钟)")
    
    # Nuitka 参数
    args = [
        sys.executable, '-m', 'nuitka',
        '--standalone',                    # 独立部署
        '--onefile',                       # 单文件输出
        '--windows-console-mode=disable',  # 禁用控制台窗口
        '--windows-icon-from-ico=public/icon_active.ico',
        '--output-dir=nuitka',             # 输出目录
        '--output-filename=PCStateMonitor.exe',
        
        # 包含数据目录
        '--include-data-dir=viewer=viewer',
        '--include-data-dir=public=public',
        '--include-data-dir=src=src',
        
        # 导入跟踪
        '--follow-imports',
        
        # 产品信息
        f'--company-name={COMPANY_NAME}',
        f'--product-name={PRODUCT_NAME}',
        f'--file-version={VERSION}',
        f'--product-version={VERSION}',
        f'--file-description={FILE_DESCRIPTION}',
        
        # 主程序入口
        'src/main.py'
    ]

    result = subprocess.run(args)

    if result.returncode == 0:
        exe_path = os.path.join('nuitka', 'PCStateMonitor.exe')
        if os.path.exists(exe_path):
            print(f"\n编译成功! 输出: {exe_path}")
            print(f"文件大小: {os.path.getsize(exe_path) / 1024 / 1024:.2f} MB")
        else:
            print(f"\n编译完成，但未找到输出文件")
    else:
        print("\n编译失败!")
        sys.exit(1)


def create_release():
    """创建发布包"""
    release_dir = f'release/pcstate-{VERSION}'
    if os.path.exists(release_dir):
        shutil.rmtree(release_dir)
    os.makedirs(release_dir)

    # 根据构建方式选择源文件路径
    if NUITKA:
        exe_path = 'nuitka/PCStateMonitor.exe'
    else:
        exe_path = 'dist/PCStateMonitor.exe'
    
    shutil.copy(exe_path, release_dir)
    if os.path.exists('README.md'):
        shutil.copy('README.md', release_dir)

    print(f"\n发布包: {os.path.abspath(release_dir)}/")

    # 创建同名zip文件（包含版本号目录）
    zip_path = f'release/pcstate-{VERSION}'
    # 使用root_dir和base_dir参数，让zip里包含 pcstate-xxx/ 目录
    shutil.make_archive(
        zip_path,
        'zip',
        root_dir='release',
        base_dir=f'pcstate-{VERSION}'
    )
    print(f"压缩包: {os.path.abspath(zip_path)}.zip")


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='打包 PCStateMonitor')
    parser.add_argument('--clean', action='store_true', help='仅清理')
    parser.add_argument('--release', action='store_true', help='创建发布包')
    parser.add_argument('--skip-frontend', action='store_true', help='跳过前端构建')
    args = parser.parse_args()

    if args.clean:
        clean_build()
    else:
        clean_build()
        if not args.skip_frontend:
            build_frontend()
        
        # 根据开关选择构建方式
        if NUITKA:
            print(f"\n{'='*50}")
            print("使用 Nuitka 编译 (实验性)")
            print(f"{'='*50}\n")
            build_exe_nuitka()
        else:
            print(f"\n{'='*50}")
            print("使用 PyInstaller 打包")
            print(f"{'='*50}\n")
            build_exe()
        
        if args.release:
            create_release()
