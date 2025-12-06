import pandas as pd
import re
import sys

def format_phone(phone):
    """Форматирует телефон в формат 8(999)111-22-33"""
    if pd.isna(phone) or phone == '' or str(phone).strip() == '':
        return ''
    
    # Убираем все нецифровые символы
    digits = re.sub(r'\D', '', str(phone))
    
    # Если номер начинается с 7, заменяем на 8
    if digits.startswith('7') and len(digits) == 11:
        digits = '8' + digits[1:]
    
    # Если номер начинается с 8 и имеет 11 цифр
    if digits.startswith('8') and len(digits) == 11:
        return f"8({digits[1:4]}){digits[4:7]}-{digits[7:9]}-{digits[9:11]}"
    
    # Если номер имеет 10 цифр (без 8 или 7)
    if len(digits) == 10:
        return f"8({digits[0:3]}){digits[3:6]}-{digits[6:8]}-{digits[8:10]}"
    
    # Если не удалось распознать формат, возвращаем как есть
    return str(phone).strip()

def clean_plot_number(plot):
    """Убирает приставку АП- из номера участка"""
    if pd.isna(plot) or plot == '':
        return ''
    
    plot_str = str(plot).strip()
    # Убираем АП- в начале
    plot_str = re.sub(r'^АП-', '', plot_str, flags=re.IGNORECASE)
    return plot_str.strip()

def process_excel_to_csv(input_file, output_file):
    """Обрабатывает Excel файл и создает CSV для загрузки"""
    try:
        # Пытаемся прочитать файл
        try:
            df = pd.read_excel(input_file, engine='xlrd')
        except:
            try:
                df = pd.read_excel(input_file, engine='openpyxl')
            except:
                # Если не получается, пробуем как CSV
                df = pd.read_csv(input_file, encoding='utf-8')
        
        print(f"Загружен файл: {df.shape[0]} строк, {df.shape[1]} столбцов")
        print(f"Столбцы: {df.columns.tolist()}")
        print("\nПервые 10 строк:")
        print(df.head(10))
        
        # Определяем столбцы по структуре файла
        # Первый столбец - участки (начинается с АП-)
        plot_col = df.columns[0]
        
        # Ищем столбцы с email, fullName, phone
        email_col = None
        name_col = None
        phone_col = None
        
        # Проверяем содержимое столбцов для определения
        for col_idx, col in enumerate(df.columns):
            # Пропускаем первый столбец (участки)
            if col_idx == 0:
                continue
            
            # Берем первые непустые значения для анализа
            sample_values = df[col].dropna().head(5).astype(str).tolist()
            
            # Проверяем, содержит ли столбец email
            if any('@' in str(v) for v in sample_values):
                email_col = col
            # Проверяем, содержит ли столбец ФИО (обычно содержит пробелы и русские буквы)
            elif any(len(str(v).split()) >= 2 and any(c.isalpha() and ord(c) > 127 for c in str(v)) for v in sample_values):
                name_col = col
            # Проверяем, содержит ли столбец телефон (цифры, +, скобки, дефисы)
            elif any(re.search(r'[\d\+\-\(\)\s]{7,}', str(v)) for v in sample_values):
                phone_col = col
        
        print(f"\nАвтоопределение столбцов:")
        print(f"Участки: {plot_col}")
        print(f"Email: {email_col}")
        print(f"ФИО: {name_col}")
        print(f"Телефон: {phone_col}")
        
        # Если не определили автоматически, используем порядок столбцов
        # Судя по выводу: столбец 0 - участки, столбец 2 - ФИО, столбец 3 - email, столбец 4 - телефон
        if not email_col and len(df.columns) > 3:
            # Проверяем столбец 3 (индекс 3)
            if '@' in str(df.iloc[0, 3]) if len(df) > 0 else False:
                email_col = df.columns[3]
            elif len(df.columns) > 2:
                email_col = df.columns[2]  # Пробуем столбец 2
        
        if not name_col and len(df.columns) > 2:
            name_col = df.columns[2]
        
        if not phone_col and len(df.columns) > 4:
            phone_col = df.columns[4]
        
        print(f"\nФинальные столбцы:")
        print(f"Участки: {plot_col}")
        print(f"Email: {email_col}")
        print(f"ФИО: {name_col}")
        print(f"Телефон: {phone_col}")
        
        # Создаем результирующий список
        result_rows = []
        
        # Обрабатываем каждую строку
        for idx, row in df.iterrows():
            # Получаем участки из первого столбца
            plots_raw = str(row[plot_col]) if not pd.isna(row[plot_col]) else ''
            
            # Разбиваем участки (могут быть через запятую, точку с запятой, или в разных строках)
            plots = []
            if plots_raw:
                # Разбиваем по различным разделителям
                plots_raw = plots_raw.replace(';', ',').replace('\n', ',').replace(' ', ',')
                plot_list = [p.strip() for p in plots_raw.split(',') if p.strip()]
                plots = [clean_plot_number(p) for p in plot_list if clean_plot_number(p)]
            
            # Если нет участков, пропускаем строку
            if not plots:
                continue
            
            # Получаем email
            email = ''
            if email_col and not pd.isna(row[email_col]):
                email = str(row[email_col]).strip()
            
            # Получаем ФИО
            full_name = ''
            if name_col and not pd.isna(row[name_col]):
                full_name = str(row[name_col]).strip()
            
            # Получаем телефон
            phone = ''
            if phone_col and not pd.isna(row[phone_col]) and str(row[phone_col]).strip():
                phone = format_phone(row[phone_col])
            
            # Создаем строку для каждого участка
            for plot in plots:
                result_rows.append({
                    'email': email,
                    'fullName': full_name,
                    'plotNumber': plot,
                    'phone': phone if phone else ''  # Пустая строка вместо NaN
                })
        
        # Создаем DataFrame
        result_df = pd.DataFrame(result_rows)
        
        # Заменяем NaN на пустые строки
        result_df = result_df.fillna('')
        
        # Сохраняем в CSV (без кавычек для пустых полей)
        result_df.to_csv(output_file, index=False, encoding='utf-8', quoting=1)  # quoting=1 означает QUOTE_MINIMAL
        
        # Статистика по пользователям
        unique_emails = result_df['email'].nunique()
        total_plots = len(result_df)
        
        print(f"\n=== СТАТИСТИКА ===")
        print(f"Всего строк в CSV: {len(result_rows)}")
        print(f"Уникальных пользователей (email): {unique_emails}")
        print(f"Всего участков: {total_plots}")
        print(f"\nПримечание: Система автоматически сгруппирует строки по email")
        print(f"и создаст одного пользователя с несколькими участками для каждого email.")
        
        # Показываем примеры пользователей с несколькими участками
        email_counts = result_df['email'].value_counts()
        multiple_plots = email_counts[email_counts > 1]
        if len(multiple_plots) > 0:
            print(f"\nПользователей с несколькими участками: {len(multiple_plots)}")
            print("\nПримеры:")
            for email, count in multiple_plots.head(5).items():
                user_plots = result_df[result_df['email'] == email]['plotNumber'].tolist()
                user_name = result_df[result_df['email'] == email]['fullName'].iloc[0]
                print(f"  {email} ({user_name}): {count} участков - {', '.join(user_plots)}")
        
        print(f"\nРезультат сохранен в: {output_file}")
        print("\nПервые 10 строк результата:")
        print(result_df.head(10))
        
        return result_df
        
    except Exception as e:
        print(f"Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    input_file = r'C:\Users\dollar\Downloads\users.xls'
    output_file = r'C:\Users\dollar\Downloads\users_processed.csv'
    
    process_excel_to_csv(input_file, output_file)

