# src 안의 page.html · style.css · *.js를 한 파일(index.html)로 묶어요:  python3 src/build.py
import os
base = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(base, n), encoding='utf8').read()
page, css = rd('page.html'), rd('style.css')
eng, dat, ui, wire = rd('engine.js'), rd('data.js'), rd('ui.js'), rd('wire.js')
for s in (eng, dat, ui, wire):
    assert '</script' not in s
# GitHub Pages용 문서 머리 (doctype · 문자셋 · 화면 폭)
HEAD = '''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="설비보전기사 과정평가형 공개문제 공기압 · 유압 12문제 배선 · 배관 연습 시뮬레이터">
<style>body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
'''
out = HEAD + page.replace('/*CSS*/', css).replace('/*ENGINE*/', eng).replace('/*DATA*/', dat).replace('/*WIRE*/', wire).replace('/*UI*/', ui)
open(os.path.join(base, '..', 'index.html'), 'w', encoding='utf8').write(out)
print('index.html', len(out))
