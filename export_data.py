from src.exporter import export_data

if __name__ == '__main__':
    data_file, valid_days = export_data()
    print(f"已生成数据文件: {data_file}")
    print(f"有效天数: {valid_days}")