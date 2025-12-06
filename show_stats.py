import pandas as pd

df = pd.read_csv(r'C:\Users\dollar\Downloads\users_processed.csv')

print('=== СТАТИСТИКА ОБРАБОТКИ ===')
print(f'Всего записей: {len(df)}')
print(f'Уникальных email: {df["email"].nunique()}')
print(f'Записей с телефонами: {len(df[df["phone"].notna() & (df["phone"] != "")])}')
print(f'Записей без телефонов: {len(df[df["phone"].isna() | (df["phone"] == "")])}')

print('\n=== ПРИМЕРЫ ЗАПИСЕЙ ===')
print(df.head(10).to_string(index=False))

print('\n\n=== ПРИМЕРЫ С ТЕЛЕФОНАМИ ===')
with_phone = df[df["phone"].notna() & (df["phone"] != "")]
print(with_phone.head(5).to_string(index=False))

print('\n\n=== ПРИМЕРЫ БЕЗ ТЕЛЕФОНОВ ===')
without_phone = df[df["phone"].isna() | (df["phone"] == "")]
print(without_phone.head(5).to_string(index=False))

print('\n\nФайл готов: C:\\Users\\dollar\\Downloads\\users_processed.csv')



