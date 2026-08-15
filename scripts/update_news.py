#!/usr/bin/env python3
import json, re, html, time
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urljoin, urlsplit, urlunsplit
import feedparser, requests
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/news.json'; TZ=ZoneInfo('Asia/Ho_Chi_Minh')
UA='Mozilla/5.0 (compatible; DNGWorksNews/3.0; +https://dngworks.github.io/)'
S=requests.Session();S.headers.update({'User-Agent':UA,'Accept-Language':'vi,en;q=0.8','Cache-Control':'no-cache'})
FEEDS={
 'latest_vn':('VnExpress','https://vnexpress.net/rss/tin-moi-nhat.rss'),
 'world':('BBC','https://feeds.bbci.co.uk/news/world/rss.xml'),
 'markets':('BBC Business','https://feeds.bbci.co.uk/news/business/rss.xml'),
 'tech_news':('BBC Technology','https://feeds.bbci.co.uk/news/technology/rss.xml'),
 'science_news':('BBC Science','https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'),
}
AI_FEEDS=[('NVIDIA','https://blogs.nvidia.com/feed/'),('Google DeepMind','https://deepmind.google/blog/rss.xml')]

def clean_text(s,limit=280):
 s=BeautifulSoup(s or '','html.parser').get_text(' ',strip=True);s=re.sub(r'\s+',' ',html.unescape(s)).strip();return s if len(s)<=limit else s[:limit-1].rsplit(' ',1)[0]+'…'
def parse_time(e):
 st=getattr(e,'published_parsed',None) or getattr(e,'updated_parsed',None)
 if not st:return ''
 return datetime.fromtimestamp(time.mktime(st),tz=timezone.utc).astimezone(TZ).strftime('%d/%m · %H:%M')
def rss_image(e):
 for key in ('media_content','media_thumbnail'):
  for x in getattr(e,key,[]) or []:
   if x.get('url'):return x['url']
 for x in getattr(e,'enclosures',[]) or []:
  if (x.get('type') or '').startswith('image') and x.get('href'):return x['href']
 content=' '.join(str(x.get('value','')) for x in getattr(e,'content',[]) or [])+' '+str(getattr(e,'summary','') or '')
 m=re.search(r'<img[^>]+src=["\']([^"\']+)',content,re.I);return m.group(1) if m else ''
def page_meta(url):
 try:
  r=S.get(url,timeout=12,allow_redirects=True);r.raise_for_status();s=BeautifulSoup(r.text,'html.parser')
  def meta(*sels):
   for attrs in sels:
    t=s.find('meta',attrs=attrs)
    if t and t.get('content'):return t['content'].strip()
   return ''
  image=meta({'property':'og:image'},{'name':'twitter:image'});desc=meta({'property':'og:description'},{'name':'description'});video=meta({'property':'og:video'},{'property':'og:video:url'},{'property':'og:video:secure_url'})
  if not video:
   iframe=s.find('iframe',src=re.compile(r'(youtube\.com/embed|youtu\.be)',re.I))
   if iframe:video=urljoin(r.url,iframe.get('src',''))
  if not video:
   source=s.find('source',src=True,type=re.compile(r'video/mp4',re.I)) or s.find('video',src=True)
   if source:video=urljoin(r.url,source.get('src',''))
  return {'image':urljoin(r.url,image) if image else '','summary':clean_text(desc),'video':video}
 except Exception:return {'image':'','summary':'','video':''}
def item(e,source):
 url=getattr(e,'link','') or '';image=rss_image(e);summary=clean_text(getattr(e,'summary',''));meta={'image':'','summary':'','video':''}
 if url and (not image or len(summary)<60):meta=page_meta(url)
 if not image:image=meta['image']
 if len(summary)<60 and meta['summary']:summary=meta['summary']
 return {'source':source,'time':parse_time(e),'title':clean_text(getattr(e,'title',''),190),'summary':summary,'url':url,'image':image,'media':'video' if meta['video'] else '','media_url':meta['video']}
def read_feed(url,source,limit):
 f=feedparser.parse(url);out=[];seen=set()
 for e in f.entries:
  x=item(e,source);k=(x['url'],x['title'].lower())
  if not x['url'] or k in seen or len(x['title'])<12:continue
  seen.add(k);out.append(x)
  if len(out)>=limit:break
 return out
def vn_popular(limit=8):
 out=[];seen=set()
 try:
  r=S.get('https://vnexpress.net/tin-xem-nhieu',timeout=15);r.raise_for_status();s=BeautifulSoup(r.text,'html.parser')
  for a in s.find_all('a',href=True):
   href=urljoin(r.url,a['href']);p=urlsplit(href)
   if 'vnexpress.net' not in p.netloc or not re.search(r'-\d+\.html$',p.path):continue
   u=urlunsplit((p.scheme,p.netloc,p.path,'',''))
   if u in seen:continue
   title=clean_text(a.get('title') or a.get_text(' ',strip=True),190)
   if len(title)<18:continue
   seen.add(u);m=page_meta(u)
   if len(m['summary'])<30:continue
   out.append({'source':'VnExpress · Xem nhiều','time':'','title':title,'summary':m['summary'],'url':u,'image':m['image'],'media':'video' if m['video'] else '','media_url':m['video']})
   if len(out)>=limit:break
 except Exception:pass
 return out
def openai_news(limit=6):
 out=[];seen=set()
 try:
  r=S.get('https://openai.com/news/',timeout=15);r.raise_for_status();s=BeautifulSoup(r.text,'html.parser')
  for a in s.find_all('a',href=True):
   href=urljoin(r.url,a['href']);p=urlsplit(href)
   if p.netloc not in ('openai.com','www.openai.com') or '/index/' not in p.path:continue
   href=urlunsplit((p.scheme,p.netloc,p.path,'','','')) if False else urlunsplit((p.scheme,p.netloc,p.path,'',''))
   if href in seen:continue
   title=clean_text(a.get_text(' ',strip=True),190)
   if len(title)<14:continue
   seen.add(href);m=page_meta(href)
   if len(m['summary'])<30:continue
   out.append({'source':'OpenAI','time':'','title':title,'summary':m['summary'],'url':href,'image':m['image'],'media':'video' if m['video'] else '','media_url':m['video']})
   if len(out)>=limit:break
 except Exception:pass
 return out
def choose_ai(limit=8):
 pool=openai_news(6)
 for source,url in AI_FEEDS:
  try:pool+=read_feed(url,source,6)
  except Exception:pass
 out=[];seen=set();bad={'skip to main content','global affairs','news','research','safety','company'}
 for x in pool:
  k=(x['title'] or '').strip().lower()
  if not x['url'] or k in seen or k in bad or len(x.get('summary',''))<30:continue
  seen.add(k);out.append(x)
  if len(out)>=limit:break
 return out
def media(data,limit=6):
 out=[];seen=set()
 for group in ('latest_vn','world','markets','ai_news','tech_news','science_news'):
  for x in data.get(group,[]):
   m=x.get('media_url')
   if not m or m in seen:continue
   seen.add(m);out.append({'source':x['source'],'title':x['title'],'media_url':m,'article_url':x['url'],'image':x.get('image','')})
   if len(out)>=limit:return out
 return out
def main():
 old={}
 if OUT.exists():
  try:old=json.loads(OUT.read_text(encoding='utf-8'))
  except Exception:pass
 data={'updated_at':datetime.now(TZ).isoformat(timespec='seconds')}
 data['latest_vn']=read_feed(FEEDS['latest_vn'][1],FEEDS['latest_vn'][0],12)
 data['popular_vn']=vn_popular(8) or [{**x,'source':'VnExpress · Nổi bật'} for x in data['latest_vn'][:8]]
 data['world']=read_feed(FEEDS['world'][1],FEEDS['world'][0],8)
 data['markets']=read_feed(FEEDS['markets'][1],FEEDS['markets'][0],8)
 data['ai_news']=choose_ai(8)
 data['tech_news']=read_feed(FEEDS['tech_news'][1],FEEDS['tech_news'][0],8)
 data['science_news']=read_feed(FEEDS['science_news'][1],FEEDS['science_news'][0],6)
 for k,minn in (('latest_vn',4),('world',3),('markets',3),('ai_news',3),('tech_news',3),('science_news',2)):
  if len(data.get(k,[]))<minn and old.get(k):data[k]=old[k]
 data['media']=media(data,6)
 OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Updated',OUT,data['updated_at']);[print(k,len(data.get(k,[]))) for k in ('latest_vn','popular_vn','world','markets','ai_news','tech_news','science_news','media')]
if __name__=='__main__':main()
