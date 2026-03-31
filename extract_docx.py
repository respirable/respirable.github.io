import zipfile
import xml.etree.ElementTree as ET

def get_docx_text(path):
    try:
        document = zipfile.ZipFile(path)
        xml_content = document.read('word/document.xml')
        document.close()
        tree = ET.fromstring(xml_content)
        
        paragraphs = []
        # XML namespace for WordprocessingML
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        
        for paragraph in tree.iterfind('.//w:p', ns):
            texts = [node.text
                     for node in paragraph.iterfind('.//w:t', ns)
                     if node.text]
            if texts:
                paragraphs.append(''.join(texts))
            else:
                paragraphs.append('') # keep empty lines
        
        return '\n'.join(paragraphs)
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    import sys
    path = "E:/operagx/thermodynamix/TUYỂN TẬP.docx"
    content = get_docx_text(path)
    with open("E:/operagx/thermodynamix/tuyen_tap_content.txt", "w", encoding="utf-8") as f:
        f.write(content)
    print("Content extracted successfully to tuyen_tap_content.txt")
