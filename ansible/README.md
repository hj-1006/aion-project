# AION Ansible (CLI 전용)

Ansible Playbook은 **웹과 연동하지 않습니다.** 터미널에서 직접 실행하여 네트워크 장비의 CPU, 메모리, 온도(환경) 정보를 확인합니다.

## 사전 준비

- Ansible 설치 (`pip install ansible` 또는 패키지 매니저)
- `ansible-galaxy collection install cisco.ios`
- 인벤토리: `inventory/hosts.ini` (예시는 `inventory/hosts.ini.example` 참고)

## 인벤토리 설정

```bash
cd ansible
cp inventory/hosts.ini.example inventory/hosts.ini
# hosts.ini를 편집하여 실제 장비 IP, 사용자, 비밀번호 설정
```

## CPU / 메모리 수집

```bash
ansible-playbook -i inventory/hosts.ini playbooks/gather_cpu_memory.yml
```

- `show processes cpu`, `show memory` 출력을 터미널에서 확인할 수 있습니다.

## 온도(환경) 수집

```bash
ansible-playbook -i inventory/hosts.ini playbooks/gather_temperature.yml
```

- `show environment` 출력을 확인합니다. (일부 IOS에서는 미지원일 수 있음)

## 웹에서 보기

웹의 **장비 메트릭** 페이지는 위 Ansible 결과와 **연동되지 않으며**, UI 미리보용 **더미 값**만 표시합니다. 실제 값을 웹에 반영하려면 별도 API/스크립트로 Playbook 결과를 DB나 API에 넣는 연동이 필요합니다.
